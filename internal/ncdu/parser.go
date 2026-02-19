package ncdu

import (
	"encoding/json"
	"fmt"
	"io"
	"sort"
)

// Parse reads ncdu's JSON output from r and returns the root DirEntry.
// ncdu format: [1, 0, {header}, [rootDir, [children...]]]
func Parse(r io.Reader) (*DirEntry, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("read ncdu output: %w", err)
	}

	var top []json.RawMessage
	if err := json.Unmarshal(data, &top); err != nil {
		return nil, fmt.Errorf("unmarshal top-level: %w", err)
	}

	if len(top) < 4 {
		return nil, fmt.Errorf("unexpected ncdu format: expected 4 elements, got %d", len(top))
	}

	// top[3] is the root directory array
	root, err := parseEntry(top[3])
	if err != nil {
		return nil, fmt.Errorf("parse root: %w", err)
	}

	return root, nil
}

// parseEntry handles a single ncdu entry which may be:
//   - A file object: {"name":"x","asize":N,"dsize":N}
//   - A directory array: [{meta}, child1, child2, ...]
func parseEntry(raw json.RawMessage) (*DirEntry, error) {
	// Try array first (directory)
	var arr []json.RawMessage
	if err := json.Unmarshal(raw, &arr); err == nil && len(arr) > 0 {
		return parseDir(arr)
	}

	// Otherwise it's a file object
	return parseFile(raw)
}

func parseDir(arr []json.RawMessage) (*DirEntry, error) {
	if len(arr) == 0 {
		return nil, fmt.Errorf("empty directory array")
	}

	// First element is the directory metadata
	entry, err := parseFile(arr[0])
	if err != nil {
		return nil, err
	}
	entry.IsDir = true

	// Remaining elements are children
	for _, childRaw := range arr[1:] {
		child, err := parseEntry(childRaw)
		if err != nil {
			continue // skip malformed entries
		}
		entry.Children = append(entry.Children, child)
	}

	// Sort children largest-first by disk size
	sort.Slice(entry.Children, func(i, j int) bool {
		return entry.Children[i].DiskSize > entry.Children[j].DiskSize
	})

	return entry, nil
}

func parseFile(raw json.RawMessage) (*DirEntry, error) {
	var meta struct {
		Name  string `json:"name"`
		ASize int64  `json:"asize"`
		DSize int64  `json:"dsize"`
	}
	if err := json.Unmarshal(raw, &meta); err != nil {
		return nil, fmt.Errorf("parse file meta: %w", err)
	}
	return &DirEntry{
		Name:      meta.Name,
		AllocSize: meta.ASize,
		DiskSize:  meta.DSize,
	}, nil
}
