// Gauge helpers using Chart.js doughnut charts (half-ring style)

const GAUGE_COLORS = {
  green:  '#3ddc84',
  yellow: '#fbbf24',
  red:    '#f87171',
  track:  '#2a2d3e',
};

function gaugeColor(pct) {
  if (pct < 60) return GAUGE_COLORS.green;
  if (pct < 85) return GAUGE_COLORS.yellow;
  return GAUGE_COLORS.red;
}

function createGauge(canvasId) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [0, 100],
        backgroundColor: [GAUGE_COLORS.green, GAUGE_COLORS.track],
        borderWidth: 0,
        borderRadius: 4,
      }],
    },
    options: {
      circumference: 180,
      rotation: -90,
      cutout: '75%',
      animation: { duration: 400, easing: 'easeOutQuart' },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

function updateGauge(chart, pct) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color = gaugeColor(clamped);
  chart.data.datasets[0].data = [clamped, 100 - clamped];
  chart.data.datasets[0].backgroundColor = [color, GAUGE_COLORS.track];
  chart.update('none');
}

window.GaugeHelper = { createGauge, updateGauge, gaugeColor };
