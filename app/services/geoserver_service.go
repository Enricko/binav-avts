package services

import (
	"bytes"
	"database/sql"
	// "encoding/json"
	// "encoding/xml"
	"fmt"
	// "io" - Remove this unused import
	"io/ioutil"
	// "mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3" // SQLite driver for GeoPackage
)

type GeoServerService struct {
	BaseURL  string
	Username string
	Password string
}

func NewGeoServerService(baseURL, username, password string) *GeoServerService {
	// Ensure BaseURL doesn't end with a slash
	baseURL = strings.TrimRight(baseURL, "/")
	return &GeoServerService{
		BaseURL:  baseURL,
		Username: username,
		Password: password,
	}
}

// GetGeoPackageTableNames reads table names from GeoPackage
func (s *GeoServerService) GetGeoPackageTableNames(filePath string) ([]string, error) {
	db, err := sql.Open("sqlite3", filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open GeoPackage: %v", err)
	}
	defer db.Close()

	// Query gpkg_contents table for layer names
	rows, err := db.Query(`
		SELECT table_name 
		FROM gpkg_contents 
		WHERE data_type = 'features'
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to query GeoPackage contents: %v", err)
	}
	defer rows.Close()

	var tableNames []string
	for rows.Next() {
		var tableName string
		if err := rows.Scan(&tableName); err != nil {
			return nil, fmt.Errorf("failed to scan table name: %v", err)
		}
		tableNames = append(tableNames, tableName)
	}

	if len(tableNames) == 0 {
		return nil, fmt.Errorf("no feature tables found in GeoPackage")
	}

	return tableNames, nil
}

// CreateDataStore creates a new datastore in GeoServer for GeoPackage files
func (s *GeoServerService) CreateDataStore(workspace, storeName, filePath string) error {
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		return fmt.Errorf("failed to get absolute path: %v", err)
	}

	datastoreXML := fmt.Sprintf(`
		<dataStore>
			<name>%s</name>
			<connectionParameters>
				<entry key="database">%s</entry>
				<entry key="dbtype">geopkg</entry>
				<entry key="Expose primary keys">true</entry>
				<entry key="fetch size">1000</entry>
				<entry key="Primary key metadata table">gpkg_contents</entry>
				<entry key="validate connections">true</entry>
				<entry key="namespace">http://www.geoserver.org/%s</entry>
			</connectionParameters>
		</dataStore>`, 
		storeName, 
		absPath,
		workspace)

	url := fmt.Sprintf("%s/rest/workspaces/%s/datastores", s.BaseURL, workspace)
	
	fmt.Printf("Creating datastore at URL: %s\n", url)
	fmt.Printf("Request body: %s\n", datastoreXML)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer([]byte(datastoreXML)))
	if err != nil {
		return fmt.Errorf("failed to create request: %v", err)
	}

	req.SetBasicAuth(s.Username, s.Password)
	req.Header.Set("Content-Type", "text/xml")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %v", err)
	}
	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("failed to create datastore (status %d): %s", resp.StatusCode, string(body))
	}

	// Wait for GeoServer to process the datastore
	time.Sleep(2 * time.Second)

	return nil
}

// PublishLayer publishes a layer from a datastore
func (s *GeoServerService) PublishLayer(workspace, storeName, tableName string) error {
	layerXML := fmt.Sprintf(`
		<featureType>
			<name>%s</name>
			<nativeName>%s</nativeName>
			<title>%s</title>
			<enabled>true</enabled>
			<srs>EPSG:4326</srs>
			<projectionPolicy>FORCE_DECLARED</projectionPolicy>
		</featureType>`, tableName, tableName, tableName)

	url := fmt.Sprintf("%s/rest/workspaces/%s/datastores/%s/featuretypes?recalculate=nativebbox,latlonbbox",
		s.BaseURL, workspace, storeName)

	fmt.Printf("Publishing layer at URL: %s\n", url)
	fmt.Printf("Request body: %s\n", layerXML)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer([]byte(layerXML)))
	if err != nil {
		return fmt.Errorf("failed to create publish request: %v", err)
	}

	req.SetBasicAuth(s.Username, s.Password)
	req.Header.Set("Content-Type", "text/xml")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send publish request: %v", err)
	}
	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("failed to publish layer (status %d): %s", resp.StatusCode, string(body))
	}

	return nil
}

// CheckWorkspaceExists checks if a workspace exists in GeoServer
func (s *GeoServerService) CheckWorkspaceExists(workspace string) (bool, error) {
	url := fmt.Sprintf("%s/rest/workspaces/%s", s.BaseURL, workspace)
	
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return false, err
	}

	req.SetBasicAuth(s.Username, s.Password)
	
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK, nil
}

// CreateWorkspace creates a new workspace in GeoServer
func (s *GeoServerService) CreateWorkspace(name string) error {
	// First check if workspace exists
	exists, err := s.CheckWorkspaceExists(name)
	if err != nil {
		return fmt.Errorf("failed to check workspace existence: %v", err)
	}

	if exists {
		return nil // Workspace already exists, no need to create
	}

	workspaceXML := fmt.Sprintf(`
		<workspace>
			<name>%s</name>
		</workspace>`, name)

	url := fmt.Sprintf("%s/rest/workspaces", s.BaseURL)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer([]byte(workspaceXML)))
	if err != nil {
		return fmt.Errorf("failed to create workspace request: %v", err)
	}

	req.SetBasicAuth(s.Username, s.Password)
	req.Header.Set("Content-Type", "text/xml")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send workspace request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		body, _ := ioutil.ReadAll(resp.Body)
		return fmt.Errorf("failed to create workspace (status %d): %s", resp.StatusCode, string(body))
	}

	return nil
}

// DeleteDataStore deletes a datastore from GeoServer
func (s *GeoServerService) DeleteDataStore(workspace, storeName string) error {
	// GeoServer REST API endpoint for deleting a datastore
	url := fmt.Sprintf("%s/rest/workspaces/%s/datastores/%s?recurse=true",
		s.BaseURL, workspace, storeName)
	
	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create delete request: %v", err)
	}

	req.SetBasicAuth(s.Username, s.Password)
	
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send delete request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("failed to delete datastore: status code %d", resp.StatusCode)
	}

	return nil
}

// CreateKMLStore creates a store for KML/KMZ files
func (s *GeoServerService) CreateKMLStore(workspace, storeName, filePath string) error {
	// Remove the unused fileDir variable
	// fileDir := filepath.Dir(filePath)
	
	// Create the datastore XML
	datastoreXML := fmt.Sprintf(`
		<dataStore>
			<name>%s</name>
			<connectionParameters>
				<entry key="url">file:%s</entry>
				<entry key="namespace">http://www.geoserver.org/%s</entry>
			</connectionParameters>
		</dataStore>`, 
		storeName, 
		filePath,
		workspace)

	url := fmt.Sprintf("%s/rest/workspaces/%s/datastores", s.BaseURL, workspace)
	
	req, err := http.NewRequest("POST", url, bytes.NewBuffer([]byte(datastoreXML)))
	if err != nil {
		return fmt.Errorf("failed to create request: %v", err)
	}

	req.SetBasicAuth(s.Username, s.Password)
	req.Header.Set("Content-Type", "text/xml")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %v", err)
	}
	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("failed to create KML datastore (status %d): %s", resp.StatusCode, string(body))
	}

	// Wait for GeoServer to process the datastore
	time.Sleep(2 * time.Second)

	return nil
}

// UploadKMLFile uploads a KML or KMZ file directly to GeoServer
func (s *GeoServerService) UploadKMLFile(workspace, storeName, layerName, filePath string) error {
	// Create a temporary store for the file
	if err := s.CreateKMLStore(workspace, storeName, filePath); err != nil {
		return fmt.Errorf("failed to create KML store: %v", err)
	}
	
	// Now publish the layer from the store
	featureTypeXML := fmt.Sprintf(`
		<featureType>
			<name>%s</name>
			<nativeName>%s</nativeName>
			<title>%s</title>
			<enabled>true</enabled>
			<srs>EPSG:4326</srs>
			<projectionPolicy>FORCE_DECLARED</projectionPolicy>
		</featureType>`, 
		layerName, 
		filepath.Base(filePath),
		layerName)
	
	url := fmt.Sprintf("%s/rest/workspaces/%s/datastores/%s/featuretypes",
		s.BaseURL, workspace, storeName)
	
	req, err := http.NewRequest("POST", url, bytes.NewBuffer([]byte(featureTypeXML)))
	if err != nil {
		return fmt.Errorf("failed to create publish request: %v", err)
	}
	
	req.SetBasicAuth(s.Username, s.Password)
	req.Header.Set("Content-Type", "text/xml")
	
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send publish request: %v", err)
	}
	defer resp.Body.Close()
	
	body, _ := ioutil.ReadAll(resp.Body)
	
	// Check both 201 (Created) and 200 (OK) as acceptable responses
	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to publish KML layer (status %d): %s", resp.StatusCode, string(body))
	}
	
	return nil
}

// Alternative method that directly uploads KML files
func (s *GeoServerService) DirectUploadKMLFile(workspace, storeName, filePath string) error {
	// Get the appropriate content type based on the file extension
	contentType := "application/vnd.google-earth.kml+xml"
	if strings.HasSuffix(strings.ToLower(filePath), ".kmz") {
		contentType = "application/vnd.google-earth.kmz"
	}
	
	// Open the file
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("failed to open file: %v", err)
	}
	defer file.Close()
	
	// Create the URL for direct file upload
	url := fmt.Sprintf("%s/rest/workspaces/%s/datastores/%s/file.%s",
		s.BaseURL, workspace, storeName, 
		strings.TrimPrefix(filepath.Ext(filePath), "."))
	
	// Send the request
	req, err := http.NewRequest("PUT", url, file)
	if err != nil {
		return fmt.Errorf("failed to create request: %v", err)
	}
	
	req.SetBasicAuth(s.Username, s.Password)
	req.Header.Set("Content-Type", contentType)
	
	client := &http.Client{
		Timeout: 60 * time.Second, // Increase timeout for larger files
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %v", err)
	}
	defer resp.Body.Close()
	
	// Check response
	body, _ := ioutil.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to upload KML file (status %d): %s", resp.StatusCode, string(body))
	}
	
	return nil
}

// UploadSimpleKMLFile uses a simpler approach to handle KML files with standard GeoServer
func (s *GeoServerService) UploadSimpleKMLFile(workspace, storeName, layerName, filePath string) error {
	// First, ensure the workspace exists
	if err := s.CreateWorkspace(workspace); err != nil {
		return fmt.Errorf("failed to create workspace: %v", err)
	}

	// For KML files, instead of trying to create a specific KML datastore,
	// we'll upload it as a general file datastore
	datastoreXML := fmt.Sprintf(`
		<dataStore>
			<name>%s</name>
			<connectionParameters>
				<entry key="url">file:%s</entry>
				<entry key="type">kml</entry>
			</connectionParameters>
		</dataStore>`, 
		storeName, 
		filePath)

	url := fmt.Sprintf("%s/rest/workspaces/%s/datastores", s.BaseURL, workspace)
	
	fmt.Printf("Creating KML datastore at URL: %s\n", url)
	
	req, err := http.NewRequest("POST", url, bytes.NewBuffer([]byte(datastoreXML)))
	if err != nil {
		return fmt.Errorf("failed to create request: %v", err)
	}

	req.SetBasicAuth(s.Username, s.Password)
	req.Header.Set("Content-Type", "text/xml")

	client := &http.Client{
		Timeout: 60 * time.Second, // Increase timeout for larger files
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %v", err)
	}
	defer resp.Body.Close()

	// If we got here, let's try to register the layer directly
	// as a simple feature instead of trying to access KML-specific features
	featureXML := fmt.Sprintf(`
		<featureType>
			<name>%s</name>
			<enabled>true</enabled>
		</featureType>`, 
		layerName)
	
	featureURL := fmt.Sprintf("%s/rest/workspaces/%s/datastores/%s/featuretypes",
		s.BaseURL, workspace, storeName)
	
	featureReq, err := http.NewRequest("POST", featureURL, bytes.NewBuffer([]byte(featureXML)))
	if err != nil {
		return fmt.Errorf("failed to create feature request: %v", err)
	}
	
	featureReq.SetBasicAuth(s.Username, s.Password)
	featureReq.Header.Set("Content-Type", "text/xml")
	
	featureResp, err := client.Do(featureReq)
	if err != nil {
		return fmt.Errorf("failed to send feature request: %v", err)
	}
	defer featureResp.Body.Close()
	
	body, _ := ioutil.ReadAll(featureResp.Body)
	if featureResp.StatusCode != http.StatusCreated && featureResp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to register KML layer (status %d): %s", featureResp.StatusCode, string(body))
	}
	
	return nil
}

// Add this method for KML/KMZ files that GeoServer can't process directly
func (s *GeoServerService) RegisterKMLAsExternalLayer(workspace, storeName, layerName, filePath string) error {
	// First ensure the workspace exists
	if err := s.CreateWorkspace(workspace); err != nil {
		return fmt.Errorf("failed to create workspace: %v", err)
	}
	
	// Create a WMS store that points to an external KML service
	// This is a fallback approach when direct KML import isn't available
	wmsStoreXML := fmt.Sprintf(`
		<wmsStore>
			<name>%s</name>
			<type>WMS</type>
			<enabled>true</enabled>
			<workspace>
				<name>%s</name>
			</workspace>
			<capabilitiesURL>file:%s</capabilitiesURL>
		</wmsStore>`,
		storeName,
		workspace,
		filePath)
	
	url := fmt.Sprintf("%s/rest/workspaces/%s/wmsstores", s.BaseURL, workspace)
	
	req, err := http.NewRequest("POST", url, bytes.NewBuffer([]byte(wmsStoreXML)))
	if err != nil {
		return fmt.Errorf("failed to create WMS store request: %v", err)
	}
	
	req.SetBasicAuth(s.Username, s.Password)
	req.Header.Set("Content-Type", "text/xml")
	
	client := &http.Client{
		Timeout: 60 * time.Second,
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send WMS store request: %v", err)
	}
	defer resp.Body.Close()
	
	// Even if this fails, we'll try to register a WMS layer
	wmsLayerXML := fmt.Sprintf(`
		<wmsLayer>
			<name>%s</name>
			<enabled>true</enabled>
			<nativeName>%s</nativeName>
			<title>%s</title>
		</wmsLayer>`,
		layerName,
		filepath.Base(filePath),
		layerName)
	
	layerURL := fmt.Sprintf("%s/rest/workspaces/%s/wmsstores/%s/wmslayers",
		s.BaseURL, workspace, storeName)
	
	layerReq, err := http.NewRequest("POST", layerURL, bytes.NewBuffer([]byte(wmsLayerXML)))
	if err != nil {
		return fmt.Errorf("failed to create WMS layer request: %v", err)
	}
	
	layerReq.SetBasicAuth(s.Username, s.Password)
	layerReq.Header.Set("Content-Type", "text/xml")
	
	layerResp, err := client.Do(layerReq)
	if err != nil {
		return fmt.Errorf("failed to send WMS layer request: %v", err)
	}
	defer layerResp.Body.Close()
	
	body, _ := ioutil.ReadAll(layerResp.Body)
	if layerResp.StatusCode != http.StatusCreated && layerResp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to register KML as WMS layer (status %d): %s", 
			layerResp.StatusCode, string(body))
	}
	
	return nil
}