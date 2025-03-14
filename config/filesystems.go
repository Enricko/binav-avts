package config

import (
	"github.com/goravel/framework/facades"
	"github.com/goravel/framework/support/path"
)

func init() {
	config := facades.Config()
	config.Add("filesystems", map[string]any{
		// Default Filesystem Disk
		//
		// Here you may specify the default filesystem disk that should be used
		// by the framework. The "local" disk, as well as a variety of cloud
		// based disks are available to your application. Just store away!
		"default": config.Env("FILESYSTEM_DISK", "local"),

		// Filesystem Disks
		//
		// Here you may configure as many filesystem "disks" as you wish, and you
		// may even configure multiple disks of the same driver. Defaults have
		// been set up for each driver as an example of the required values.
		//
		// Supported Drivers: "local", "custom"
		"disks": map[string]any{
			"local": map[string]any{
				"driver":        "local",
				"root":          config.Env("FILESYSTEM_LOCAL_ROOT", "storage/app"),
				"url":           config.Env("FILESYSTEM_LOCAL_URL", "storage"),
				"max_file_size": 100 * 1024 * 1024,
			},
			// "local": map[string]any{
			// 	"driver": "local",
			// 	"root":   path.Storage("app"),
			// },
			"public": map[string]any{
				"driver":     "local",
				"root":       path.Storage("app/public"),
				"url":        config.Env("APP_URL", "").(string) + "/storage",
				"visibility": "public",
				// Set a higher max file size (100MB)
				"max_file_size": 100 * 1024 * 1024,
			},
			"s3": map[string]any{
				"driver": "s3",
				"key":    config.Env("AWS_ACCESS_KEY_ID", ""),
				"secret": config.Env("AWS_ACCESS_KEY_SECRET", ""),
				"region": config.Env("AWS_DEFAULT_REGION", ""),
				"bucket": config.Env("AWS_BUCKET", ""),
				"url":    config.Env("AWS_URL", ""),
				// Set a higher max file size for S3 too
				"max_file_size": 100 * 1024 * 1024,
			},
		},
	})
}
