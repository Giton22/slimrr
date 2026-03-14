package pb

import (
	"embed"
	"os"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"

	// Register migrations
	_ "bodyweight-tracker/migrations"
)

//go:embed all:pb_public
var distDir embed.FS

var distDirFS = apis.MustSubFS(distDir, "pb_public")

func Start() error {
	app := pocketbase.New()

	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		Automigrate: false,
	})

	// Serve embedded frontend
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		registerDataCsvRoutes(se)
		se.Router.GET("/{path...}", apis.Static(distDirFS, true))
		return se.Next()
	})

	// Bootstrap superuser from environment variables on first serve
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		email := os.Getenv("PB_ADMIN_EMAIL")
		password := os.Getenv("PB_ADMIN_PASSWORD")
		if email == "" || password == "" {
			return se.Next()
		}

		superusers, err := app.FindCollectionByNameOrId(core.CollectionNameSuperusers)
		if err != nil {
			return se.Next()
		}

		// Check if superuser already exists
		existing, _ := app.FindAuthRecordByEmail(superusers, email)
		if existing != nil {
			// Update password in case it changed
			existing.SetPassword(password)
			if err := app.Save(existing); err != nil {
				app.Logger().Error("Failed to update superuser", "error", err)
			}
			return se.Next()
		}

		// Create new superuser
		record := core.NewRecord(superusers)
		record.Set("email", email)
		record.SetPassword(password)
		if err := app.Save(record); err != nil {
			app.Logger().Error("Failed to create superuser", "error", err)
		}

		return se.Next()
	})

	return app.Start()
}
