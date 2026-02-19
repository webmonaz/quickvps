package ncdu

import (
	"strings"
	"testing"
)

func TestParseSuccessWithSortingAndAggregation(t *testing.T) {
	json := `[
		1,
		0,
		{"progname":"ncdu"},
		[
			{"name":"/","asize":1,"dsize":1},
			{"name":"small.txt","asize":5,"dsize":50},
			[
				{"name":"logs","asize":2,"dsize":2},
				{"name":"app.log","asize":10,"dsize":400}
			],
			"malformed-child"
		]
	]`

	root, err := Parse(strings.NewReader(json))
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}

	if !root.IsDir {
		t.Fatalf("root.IsDir = false, want true")
	}
	if root.Name != "/" {
		t.Fatalf("root.Name = %q, want %q", root.Name, "/")
	}
	if len(root.Children) != 2 {
		t.Fatalf("len(root.Children) = %d, want 2", len(root.Children))
	}

	if root.DiskSize != 450 {
		t.Fatalf("root.DiskSize = %d, want 450", root.DiskSize)
	}

	if root.Children[0].Name != "logs" || root.Children[0].DiskSize != 400 {
		t.Fatalf("child[0] = %+v, want logs with dsize 400", root.Children[0])
	}
	if root.Children[1].Name != "small.txt" || root.Children[1].DiskSize != 50 {
		t.Fatalf("child[1] = %+v, want small.txt with dsize 50", root.Children[1])
	}
}

func TestParseInvalidPayload(t *testing.T) {
	t.Run("invalid json", func(t *testing.T) {
		_, err := Parse(strings.NewReader("not-json"))
		if err == nil {
			t.Fatalf("Parse() error = nil, want non-nil")
		}
	})

	t.Run("invalid top level length", func(t *testing.T) {
		_, err := Parse(strings.NewReader(`[1,0,{}]`))
		if err == nil {
			t.Fatalf("Parse() error = nil, want non-nil")
		}
	})
}
