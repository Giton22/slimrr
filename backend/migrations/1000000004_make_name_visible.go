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

		// Allow any authenticated user to list/view other users
		// (sensitive fields like email, tokenKey, password remain hidden
		// by PocketBase's built-in auth field protections).
		col.ListRule = types.Pointer(`@request.auth.id != ""`)
		col.ViewRule = types.Pointer(`@request.auth.id != ""`)

		// Ensure the name field is visible (not hidden) so it appears
		// in expanded relation responses for other users.
		col.Fields.Add(&core.TextField{
			Name:   "name",
			Hidden: false,
		})

		return app.Save(col)
	}, func(app core.App) error {
		// rollback: restore default restrictive rules
		col, err := app.FindCollectionByNameOrId("_pb_users_auth_")
		if err != nil {
			return err
		}
		col.ListRule = nil
		col.ViewRule = nil
		return app.Save(col)
	})
}
