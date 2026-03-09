package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		usersCollection, err := app.FindCollectionByNameOrId("_pb_users_auth_")
		if err != nil {
			return err
		}

		// ────────────────────────────────────────────────
		// Phase A: Create all collections with permissive
		// placeholder rules (no back-relation references).
		// ────────────────────────────────────────────────

		// ── groups ──
		groups := core.NewBaseCollection("groups")
		groups.ListRule = types.Pointer(`@request.auth.id != ""`)
		groups.ViewRule = types.Pointer(`@request.auth.id != ""`)
		groups.CreateRule = types.Pointer(`@request.auth.id != ""`)
		groups.UpdateRule = types.Pointer("created_by = @request.auth.id")
		groups.DeleteRule = types.Pointer("created_by = @request.auth.id")
		groups.Fields.Add(
			&core.TextField{
				Name:     "name",
				Required: true,
				Max:      100,
			},
			&core.TextField{
				Name:     "description",
				Required: false,
				Max:      500,
			},
			&core.TextField{
				Name:     "invite_code",
				Required: true,
				Max:      8,
				Pattern:  `^[A-Z0-9]{8}$`,
			},
			&core.RelationField{
				Name:          "created_by",
				Required:      true,
				MaxSelect:     1,
				CollectionId:  usersCollection.Id,
				CascadeDelete: false,
			},
			&core.AutodateField{
				Name:     "created",
				OnCreate: true,
			},
			&core.AutodateField{
				Name:     "updated",
				OnCreate: true,
				OnUpdate: true,
			},
		)
		groups.AddIndex("idx_groups_invite_code", true, "invite_code", "")
		if err := app.Save(groups); err != nil {
			return err
		}

		// Re-fetch to get the saved collection with its ID
		groupsCollection, err := app.FindCollectionByNameOrId("groups")
		if err != nil {
			return err
		}

		// ── group_members ──
		groupMembers := core.NewBaseCollection("group_members")
		groupMembers.ListRule = types.Pointer(`@request.auth.id != ""`)
		groupMembers.ViewRule = types.Pointer(`@request.auth.id != ""`)
		groupMembers.CreateRule = types.Pointer(`@request.auth.id != ""`)
		groupMembers.UpdateRule = nil
		groupMembers.DeleteRule = types.Pointer(`user = @request.auth.id || group.created_by = @request.auth.id`)
		groupMembers.Fields.Add(
			&core.RelationField{
				Name:          "group",
				Required:      true,
				MaxSelect:     1,
				CollectionId:  groupsCollection.Id,
				CascadeDelete: true,
			},
			&core.RelationField{
				Name:          "user",
				Required:      true,
				MaxSelect:     1,
				CollectionId:  usersCollection.Id,
				CascadeDelete: true,
			},
			&core.SelectField{
				Name:      "role",
				Required:  true,
				MaxSelect: 1,
				Values:    []string{"owner", "member"},
			},
			&core.AutodateField{
				Name:     "created",
				OnCreate: true,
			},
			&core.AutodateField{
				Name:     "updated",
				OnCreate: true,
				OnUpdate: true,
			},
		)
		groupMembers.AddIndex("idx_group_members_group_user", true, "\"group\", user", "")
		if err := app.Save(groupMembers); err != nil {
			return err
		}

		// ── goals ── (no back-relations, final rules from the start)
		goals := core.NewBaseCollection("goals")
		goals.ListRule = types.Pointer(`user = @request.auth.id || (visibility != "private" && @request.auth.id != "")`)
		goals.ViewRule = types.Pointer(`user = @request.auth.id || (visibility != "private" && @request.auth.id != "")`)
		goals.CreateRule = types.Pointer(`@request.auth.id != ""`)
		goals.UpdateRule = types.Pointer("user = @request.auth.id")
		goals.DeleteRule = types.Pointer("user = @request.auth.id")
		goals.Fields.Add(
			&core.RelationField{
				Name:          "user",
				Required:      true,
				MaxSelect:     1,
				CollectionId:  usersCollection.Id,
				CascadeDelete: true,
			},
			&core.TextField{
				Name:     "title",
				Required: true,
				Max:      200,
			},
			&core.TextField{
				Name:     "description",
				Required: false,
				Max:      1000,
			},
			&core.NumberField{
				Name:     "target_value",
				Required: false,
				Min:      types.Pointer(0.0),
				Max:      types.Pointer(99999.0),
			},
			&core.NumberField{
				Name:     "current_value",
				Required: false,
				Min:      types.Pointer(0.0),
				Max:      types.Pointer(99999.0),
			},
			&core.TextField{
				Name:     "unit",
				Required: false,
				Max:      50,
			},
			&core.SelectField{
				Name:      "visibility",
				Required:  true,
				MaxSelect: 1,
				Values:    []string{"private", "group", "public"},
			},
			&core.SelectField{
				Name:      "status",
				Required:  true,
				MaxSelect: 1,
				Values:    []string{"active", "completed", "abandoned"},
			},
			&core.TextField{
				Name:     "due_date",
				Required: false,
				Pattern:  `^\d{4}-\d{2}-\d{2}$`,
			},
			&core.AutodateField{
				Name:     "created",
				OnCreate: true,
			},
			&core.AutodateField{
				Name:     "updated",
				OnCreate: true,
				OnUpdate: true,
			},
		)
		goals.AddIndex("idx_goals_user", false, "user", "")
		if err := app.Save(goals); err != nil {
			return err
		}

		// ────────────────────────────────────────────────
		// Phase B: Now that all collections exist, update
		// groups and group_members with back-relation rules.
		// ────────────────────────────────────────────────

		groupsCollection, err = app.FindCollectionByNameOrId("groups")
		if err != nil {
			return err
		}
		// ListRule: any authenticated user can search groups (needed for invite code lookup).
		// Without knowing an invite code, listing returns nothing useful.
		// ViewRule: only members can view a group by ID (after joining).
		groupsCollection.ListRule = types.Pointer(`@request.auth.id != ""`)
		groupsCollection.ViewRule = types.Pointer(`@request.auth.id != "" && @request.auth.id ?= group_members_via_group.user`)
		if err := app.Save(groupsCollection); err != nil {
			return err
		}

		groupMembersCollection, err := app.FindCollectionByNameOrId("group_members")
		if err != nil {
			return err
		}
		groupMembersCollection.ListRule = types.Pointer(`@request.auth.id != "" && @request.auth.id ?= group.group_members_via_group.user`)
		groupMembersCollection.ViewRule = types.Pointer(`@request.auth.id != "" && @request.auth.id ?= group.group_members_via_group.user`)
		return app.Save(groupMembersCollection)
	}, func(app core.App) error {
		for _, name := range []string{"goals", "group_members", "groups"} {
			col, err := app.FindCollectionByNameOrId(name)
			if err != nil {
				continue
			}
			if err := app.Delete(col); err != nil {
				return err
			}
		}
		return nil
	})
}
