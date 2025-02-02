package services

import (
	"bytes"
	"database/sql"
	"fmt"
	"io/ioutil"
	"net/http"
	"path/filepath"
	"strings"
	"time"
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
    db, err := sql.Open("sqlite", filePath)
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