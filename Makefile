BINARY   := quickvps
VERSION  := $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
LDFLAGS  := -ldflags "-s -w -X quickvps/internal/server.AppVersion=$(VERSION)"

.PHONY: build linux linux-arm64 frontend build-full install tidy clean

## build: compile for current OS/arch
build:
	go build $(LDFLAGS) -o $(BINARY) .

## linux: cross-compile for Linux amd64
linux:
	GOOS=linux GOARCH=amd64 go build $(LDFLAGS) -o $(BINARY)-linux .

## linux-arm64: cross-compile for Linux arm64 (e.g. Oracle Cloud free tier)
linux-arm64:
	GOOS=linux GOARCH=arm64 go build $(LDFLAGS) -o $(BINARY)-linux-arm64 .

## frontend: build the React frontend (outputs to web/)
frontend:
	cd frontend && npm run build

## build-full: build frontend then cross-compile Go binary for Linux amd64
build-full: frontend linux

## tidy: download and tidy go modules
tidy:
	go mod tidy

## install: copy binary to remote HOST over SSH and restart systemd service
##   Usage: make install HOST=user@1.2.3.4
install: linux
	scp $(BINARY)-linux $(HOST):/usr/local/bin/$(BINARY)
	ssh $(HOST) "systemctl restart $(BINARY) && systemctl status $(BINARY) --no-pager"

## clean: remove compiled binaries
clean:
	rm -f $(BINARY) $(BINARY)-linux $(BINARY)-linux-arm64
