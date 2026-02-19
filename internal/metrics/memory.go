package metrics

import (
	"github.com/shirou/gopsutil/v3/mem"
)

func collectMemory() (MemMetrics, SwapMetrics) {
	mMem := MemMetrics{}
	mSwap := SwapMetrics{}

	vm, err := mem.VirtualMemory()
	if err == nil {
		mMem.TotalBytes = vm.Total
		mMem.UsedBytes = vm.Used
		mMem.FreeBytes = vm.Free
		mMem.Cached = vm.Cached
		mMem.Buffers = vm.Buffers
		mMem.Percent = vm.UsedPercent
	}

	sm, err := mem.SwapMemory()
	if err == nil {
		mSwap.TotalBytes = sm.Total
		mSwap.UsedBytes = sm.Used
		mSwap.FreeBytes = sm.Free
		mSwap.Percent = sm.UsedPercent
	}

	return mMem, mSwap
}
