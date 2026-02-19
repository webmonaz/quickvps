// Collapsible directory tree renderer for ncdu results

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

function buildTreeNode(entry, parentSize, depth) {
  const li = document.createElement('li');
  li.className = 'tree-node';

  const pct = parentSize > 0 ? (entry.dsize / parentSize * 100) : 100;
  const pctStr = pct.toFixed(1) + '%';

  // Color based on percentage
  let barColor = '#4c9ef5';
  if (pct > 50) barColor = '#f87171';
  else if (pct > 20) barColor = '#fbbf24';

  const row = document.createElement('div');
  row.className = 'tree-node-row';

  const expandIcon = document.createElement('i');
  expandIcon.className = 'expand-icon';

  const typeIcon = document.createElement('i');
  typeIcon.className = 'tree-icon' + (entry.is_dir ? '' : ' file');
  typeIcon.textContent = entry.is_dir ? '📁' : '📄';

  const nameEl = document.createElement('span');
  nameEl.className = 'tree-name';
  nameEl.textContent = entry.name;
  nameEl.title = entry.name;

  const barOuter = document.createElement('div');
  barOuter.className = 'tree-bar-outer';
  const barFill = document.createElement('div');
  barFill.className = 'tree-bar-fill';
  barFill.style.width = Math.min(100, pct) + '%';
  barFill.style.background = barColor;
  barOuter.appendChild(barFill);

  const pctEl = document.createElement('span');
  pctEl.className = 'tree-pct';
  pctEl.textContent = pctStr;
  pctEl.style.color = barColor;

  const sizeEl = document.createElement('span');
  sizeEl.className = 'tree-size';
  sizeEl.textContent = formatSize(entry.dsize);

  row.appendChild(expandIcon);
  row.appendChild(typeIcon);
  row.appendChild(nameEl);
  row.appendChild(barOuter);
  row.appendChild(pctEl);
  row.appendChild(sizeEl);
  li.appendChild(row);

  if (entry.is_dir && entry.children && entry.children.length > 0) {
    const ul = document.createElement('ul');
    ul.className = 'tree-children' + (depth >= 2 ? ' collapsed' : '');

    expandIcon.textContent = depth < 2 ? '▾' : '▸';
    expandIcon.style.color = '#4a5568';

    // Only render top levels eagerly; deeper levels on expand
    if (depth < 2) {
      entry.children.forEach(child => {
        ul.appendChild(buildTreeNode(child, entry.dsize, depth + 1));
      });
    }

    let rendered = depth < 2;
    row.addEventListener('click', () => {
      const collapsed = ul.classList.toggle('collapsed');
      expandIcon.textContent = collapsed ? '▸' : '▾';

      if (!rendered && !collapsed) {
        rendered = true;
        entry.children.forEach(child => {
          ul.appendChild(buildTreeNode(child, entry.dsize, depth + 1));
        });
      }
    });

    li.appendChild(ul);
  } else {
    expandIcon.textContent = ' ';
  }

  return li;
}

function renderNcduTree(container, result) {
  container.innerHTML = '';

  if (!result || !result.root) {
    container.innerHTML = '<p style="color:var(--text-secondary);padding:16px;">No scan data available.</p>';
    return;
  }

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font-family:monospace;font-size:12px;color:var(--text-secondary)';
  header.innerHTML = `
    <span>Path: <strong style="color:var(--accent-blue)">${result.path}</strong></span>
    <span>Total: <strong style="color:var(--text-primary)">${formatSize(result.total_size)}</strong></span>
    <span>Scanned: ${new Date(result.scanned_at).toLocaleString()}</span>
  `;
  container.appendChild(header);

  const ul = document.createElement('ul');
  ul.className = 'ncdu-tree';

  const rootNode = buildTreeNode(result.root, result.total_size, 0);
  ul.appendChild(rootNode);
  container.appendChild(ul);
}

window.NcduRenderer = { renderNcduTree, formatSize };
