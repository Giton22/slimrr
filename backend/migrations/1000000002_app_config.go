package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		// A single-row collection used to track whether first-run setup has been completed.
		// Anyone (unauthenticated) can read it so the frontend can detect first-launch.
		// Only authenticated users can update it (to mark setup as complete).
		// Nobody can create/delete via API — the seed record is created in this migration.
		appConfig := core.NewBaseCollection("app_config")
		appConfig.ListRule = types.Pointer("")
		appConfig.ViewRule = types.Pointer("")
		appConfig.CreateRule = nil
		appConfig.UpdateRule = types.Pointer(`@request.auth.id != ""`)
		appConfig.DeleteRule = nil
		appConfig.Fields.Add(
			&core.BoolField{
				Name:     "setup_complete",
				Required: false,
			},
		)
		if err := app.Save(appConfig); err != nil {
			return err
		}

		// Seed the single config record
		col, err := app.FindCollectionByNameOrId("app_config")
		if err != nil {
			return err
		}
		record := core.NewRecord(col)
		record.Set("setup_complete", false)
		return app.Save(record)
	}, func(app core.App) error {
		col, err := app.FindCollectionByNameOrId("app_config")
		if err != nil {
			return nil
		}
		return app.Delete(col)
	})
}
