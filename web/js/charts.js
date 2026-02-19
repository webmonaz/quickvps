// Rolling line chart helpers

const CHART_POINTS = 60;

function makeDataset(label, color, fill) {
  return {
    label,
    data: new Array(CHART_POINTS).fill(0),
    borderColor: color,
    backgroundColor: fill
      ? color.replace(')', ', 0.15)').replace('rgb', 'rgba').replace('#', 'rgba(').replace('rgba(', 'rgba(')
      : 'transparent',
    borderWidth: 1.5,
    pointRadius: 0,
    tension: 0.3,
    fill: fill,
  };
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function makeDatasetHex(label, hex, fill) {
  return {
    label,
    data: new Array(CHART_POINTS).fill(0),
    borderColor: hex,
    backgroundColor: fill ? hexToRgba(hex, 0.15) : 'transparent',
    borderWidth: 1.5,
    pointRadius: 0,
    tension: 0.3,
    fill: fill,
  };
}

function createLineChart(canvasId, datasets, yFormatter) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: new Array(CHART_POINTS).fill(''),
      datasets,
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${yFormatter(ctx.raw)}`,
          },
        },
      },
      scales: {
        x: {
          display: false,
          grid: { display: false },
        },
        y: {
          display: true,
          position: 'right',
          grid: { color: '#2a2d3e', drawBorder: false },
          border: { display: false },
          ticks: {
            color: '#4a5568',
            font: { size: 10, family: 'monospace' },
            maxTicksLimit: 4,
            callback: yFormatter,
          },
          beginAtZero: true,
        },
      },
    },
  });
}

function pushData(chart, ...values) {
  chart.data.datasets.forEach((ds, i) => {
    ds.data.shift();
    ds.data.push(values[i] ?? 0);
  });
  chart.update('none');
}

function formatBytes(bps) {
  if (bps < 1024) return bps.toFixed(0) + ' B/s';
  if (bps < 1024 * 1024) return (bps / 1024).toFixed(1) + ' KB/s';
  return (bps / 1024 / 1024).toFixed(1) + ' MB/s';
}

window.ChartHelper = { makeDatasetHex, createLineChart, pushData, formatBytes };
