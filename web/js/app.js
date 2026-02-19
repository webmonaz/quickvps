// QuickVPS Dashboard — WebSocket client + orchestration

(function () {
  'use strict';

  // ─── State ────────────────────────────────────────────────────────────────
  let ws = null;
  let reconnectTimer = null;
  let cpuGauge, memGauge, swapGauge;
  let netChart, diskIOChart;
  let serverInfo = {};

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function formatBytes(b) {
    if (b == null) return '—';
    if (b < 1024) return b + ' B';
    if (b < 1024 ** 2) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1024 ** 3) return (b / 1024 ** 2).toFixed(1) + ' MB';
    return (b / 1024 ** 3).toFixed(2) + ' GB';
  }

  function el(id) { return document.getElementById(id); }

  function setDotConnected(ok) {
    const dot = el('status-dot');
    const banner = el('connection-banner');
    if (ok) {
      dot.classList.remove('disconnected');
      banner.classList.remove('show');
    } else {
      dot.classList.add('disconnected');
      banner.classList.add('show');
    }
  }

  // ─── Init gauges + charts ─────────────────────────────────────────────────
  function initCharts() {
    cpuGauge  = GaugeHelper.createGauge('cpu-gauge');
    memGauge  = GaugeHelper.createGauge('mem-gauge');
    swapGauge = GaugeHelper.createGauge('swap-gauge');

    netChart = ChartHelper.createLineChart('net-chart', [
      ChartHelper.makeDatasetHex('Recv', '#3ddc84', true),
      ChartHelper.makeDatasetHex('Sent', '#f87171', true),
    ], ChartHelper.formatBytes);

    diskIOChart = ChartHelper.createLineChart('diskio-chart', [
      ChartHelper.makeDatasetHex('Read',  '#4c9ef5', true),
      ChartHelper.makeDatasetHex('Write', '#a78bfa', true),
    ], ChartHelper.formatBytes);
  }

  // ─── Load server info ─────────────────────────────────────────────────────
  async function loadInfo() {
    try {
      const r = await fetch('/api/info');
      serverInfo = await r.json();
      el('header-hostname').textContent = serverInfo.hostname || '—';
      el('header-os').textContent = serverInfo.os || '—';
    } catch (_) {}
  }

  // ─── Render snapshot ──────────────────────────────────────────────────────
  function renderSnapshot(snap) {
    renderCPU(snap.cpu);
    renderMemory(snap.memory, snap.swap);
    renderDisks(snap.disks, snap.disk_io);
    renderNetwork(snap.network);
  }

  function renderCPU(cpu) {
    if (!cpu) return;
    const pct = Math.round(cpu.total_percent || 0);
    GaugeHelper.updateGauge(cpuGauge, pct);
    el('cpu-pct').textContent = pct;
    el('cpu-model').textContent = cpu.model_name || '—';
    el('cpu-freq').textContent = cpu.freq_mhz ? cpu.freq_mhz.toFixed(0) + ' MHz' : '—';

    // Per-core bars
    const container = el('cpu-cores');
    if (!container || !cpu.per_core) return;
    const cores = cpu.per_core;
    if (container.children.length !== cores.length) {
      container.innerHTML = '';
      cores.forEach((_, i) => {
        container.innerHTML += `
          <div class="core-item">
            <div class="core-bar"><div class="core-bar-fill" id="core-${i}" style="height:0%"></div></div>
            <span class="core-label">C${i}</span>
          </div>`;
      });
    }
    cores.forEach((p, i) => {
      const bar = el(`core-${i}`);
      if (!bar) return;
      const h = Math.min(100, Math.round(p));
      bar.style.height = h + '%';
      bar.className = 'core-bar-fill' + (p >= 85 ? ' danger' : p >= 60 ? ' warn' : '');
    });
  }

  function renderMemory(mem, swap) {
    if (!mem) return;
    const memPct = Math.round(mem.percent || 0);
    GaugeHelper.updateGauge(memGauge, memPct);
    el('mem-pct').textContent = memPct;
    el('mem-detail').textContent = `${formatBytes(mem.used_bytes)} / ${formatBytes(mem.total_bytes)}`;

    // Memory bar breakdown
    if (mem.total_bytes > 0) {
      const usedW  = (mem.used_bytes / mem.total_bytes * 100).toFixed(1);
      const cachedW = (mem.cached / mem.total_bytes * 100).toFixed(1);
      const bufW   = (mem.buffers / mem.total_bytes * 100).toFixed(1);
      const usedBar = el('mem-bar-used');
      const cachedBar = el('mem-bar-cached');
      const bufBar = el('mem-bar-buffers');
      if (usedBar) usedBar.style.width = usedW + '%';
      if (cachedBar) cachedBar.style.width = cachedW + '%';
      if (bufBar) bufBar.style.width = bufW + '%';
      const usedLbl = el('mem-used-label');
      const cachedLbl = el('mem-cached-label');
      const bufLbl = el('mem-buf-label');
      if (usedLbl) usedLbl.textContent = formatBytes(mem.used_bytes);
      if (cachedLbl) cachedLbl.textContent = formatBytes(mem.cached);
      if (bufLbl) bufLbl.textContent = formatBytes(mem.buffers);
    }

    if (!swap) return;
    const swapPct = Math.round(swap.percent || 0);
    GaugeHelper.updateGauge(swapGauge, swapPct);
    el('swap-pct').textContent = swapPct;
    el('swap-detail').textContent = swap.total_bytes > 0
      ? `${formatBytes(swap.used_bytes)} / ${formatBytes(swap.total_bytes)}`
      : 'No swap';
  }

  function renderDisks(disks, diskIO) {
    const container = el('disks-container');
    if (!container || !disks) return;
    container.innerHTML = '';

    disks.forEach(d => {
      const pct = Math.round(d.percent || 0);
      const fillClass = pct >= 85 ? 'danger' : pct >= 60 ? 'warn' : '';

      // Find IO for this device
      const shortDev = d.device.split('/').pop();
      const io = (diskIO || []).find(x => x.device === shortDev || d.device.includes(x.device));

      const ioHtml = io
        ? `<div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11px;font-family:monospace;color:var(--text-secondary)">
             <span>R: <span style="color:#4c9ef5">${ChartHelper.formatBytes(io.read_bps)}</span></span>
             <span>W: <span style="color:#a78bfa">${ChartHelper.formatBytes(io.write_bps)}</span></span>
           </div>`
        : '';

      container.innerHTML += `
        <div class="card disk-card">
          <div class="disk-header">
            <div>
              <div class="disk-mount">${d.mountpoint}</div>
              <div class="disk-device">${d.device} · ${d.fstype}</div>
            </div>
            <div class="disk-pct" style="color:${pct>=85?'var(--accent-red)':pct>=60?'var(--accent-yellow)':'var(--accent-green)'}">${pct}%</div>
          </div>
          <div class="disk-bar"><div class="disk-bar-fill ${fillClass}" style="width:${pct}%"></div></div>
          <div class="disk-stats">
            <span>Used: ${formatBytes(d.used_bytes)}</span>
            <span>Free: ${formatBytes(d.free_bytes)}</span>
            <span>Total: ${formatBytes(d.total_bytes)}</span>
          </div>
          ${ioHtml}
        </div>`;
    });

    // Aggregate disk I/O for chart
    if (diskIO && diskIO.length > 0) {
      const totalRead  = diskIO.reduce((s, x) => s + x.read_bps, 0);
      const totalWrite = diskIO.reduce((s, x) => s + x.write_bps, 0);
      ChartHelper.pushData(diskIOChart, totalRead, totalWrite);
    }
  }

  function renderNetwork(nets) {
    if (!nets) return;

    // Update chart with aggregate
    const totalRecv = nets.reduce((s, n) => s + n.recv_bps, 0);
    const totalSent = nets.reduce((s, n) => s + n.sent_bps, 0);
    ChartHelper.pushData(netChart, totalRecv, totalSent);

    // Update table
    const tbody = el('net-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    nets.forEach(n => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="iface">${n.interface}</td>
        <td class="recv">${ChartHelper.formatBytes(n.recv_bps)}</td>
        <td class="sent">${ChartHelper.formatBytes(n.sent_bps)}</td>
        <td>${formatBytes(n.total_recv)}</td>
        <td>${formatBytes(n.total_sent)}</td>`;
      tbody.appendChild(tr);
    });
  }

  // ─── ncdu ─────────────────────────────────────────────────────────────────
  function initNcdu() {
    const scanBtn  = el('scan-btn');
    const cancelBtn = el('cancel-btn');
    const pathInput = el('scan-path');
    const statusEl = el('scan-status-text');
    const spinnerEl = el('scan-spinner');

    if (scanBtn) {
      scanBtn.addEventListener('click', async () => {
        const path = pathInput?.value || '/';
        scanBtn.disabled = true;
        if (cancelBtn) cancelBtn.style.display = 'inline-flex';
        if (statusEl) statusEl.textContent = 'Starting scan…';
        if (spinnerEl) spinnerEl.style.display = 'block';

        await fetch('/api/ncdu/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path }),
        });
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', async () => {
        await fetch('/api/ncdu/scan', { method: 'DELETE' });
        resetScanUI();
      });
    }
  }

  function resetScanUI() {
    const scanBtn   = el('scan-btn');
    const cancelBtn = el('cancel-btn');
    const statusEl  = el('scan-status-text');
    const spinnerEl = el('scan-spinner');
    if (scanBtn) scanBtn.disabled = false;
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (statusEl) statusEl.textContent = '';
    if (spinnerEl) spinnerEl.style.display = 'none';
  }

  async function fetchAndRenderNcdu() {
    try {
      const r = await fetch('/api/ncdu/status');
      const result = await r.json();
      const container = el('ncdu-tree-container');

      const statusEl  = el('scan-status-text');
      const spinnerEl = el('scan-spinner');

      if (result.status === 'done') {
        resetScanUI();
        if (statusEl) statusEl.textContent = 'Scan complete';
        NcduRenderer.renderNcduTree(container, result);
      } else if (result.status === 'error') {
        resetScanUI();
        if (statusEl) statusEl.textContent = 'Error: ' + result.error;
        if (spinnerEl) spinnerEl.style.display = 'none';
      } else if (result.status === 'running') {
        if (statusEl) statusEl.textContent = 'Scanning ' + result.path + '…';
      }
    } catch (e) {
      console.error('fetchNcdu error:', e);
    }
  }

  // ─── WebSocket ────────────────────────────────────────────────────────────
  function connectWS() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${location.host}/ws`);

    ws.onopen = () => {
      setDotConnected(true);
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'metrics' && msg.snapshot) {
          renderSnapshot(msg.snapshot);
        }
        if (msg.ncdu_ready) {
          fetchAndRenderNcdu();
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    ws.onclose = () => {
      setDotConnected(false);
      reconnectTimer = setTimeout(connectWS, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  // ─── Bootstrap ────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    initNcdu();
    loadInfo();
    connectWS();
  });
})();
