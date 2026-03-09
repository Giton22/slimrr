package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		col, err := app.FindCollectionByNameOrId("_pb_users_auth_")
		if err != nil {
			return err
		}

		// Allow any authenticated user to list/view other users so that
		// expanding the "user" relation on group_members returns data.
		// Sensitive fields (email, tokenKey, password) remain protected
		// by PocketBase's built-in auth field visibility rules.
		col.ListRule = types.Pointer(`@request.auth.id != ""`)
		col.ViewRule = types.Pointer(`@request.auth.id != ""`)

		return app.Save(col)
	}, func(app core.App) error {
		col, err := app.FindCollectionByNameOrId("_pb_users_auth_")
		if err != nil {
			return err
		}
		col.ListRule = nil
		col.ViewRule = nil
		return app.Save(col)
	})
}
