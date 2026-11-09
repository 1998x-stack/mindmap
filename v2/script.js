class MindMap {
    constructor(container) {
        this.container = container;
        this.nodes = [];
        this.selectedNode = null;
        this.idCounter = 1;
        this.db = null;
        this.initDatabase();
        this.init();
    }

    async initDatabase() {
        try {
            const SQL = await initSqlJs({ locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}` });
            this.db = new SQL.Database();
            
            // Create nodes table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS nodes (
                    id INTEGER PRIMARY KEY,
                    text TEXT NOT NULL,
                    x REAL NOT NULL,
                    y REAL NOT NULL,
                    parent_id INTEGER
                );
            `);
            
            this.loadNodesFromDB();
        } catch (err) {
            console.error("Database initialization failed:", err);
            this.loadNodesFromLocalStorage();
        }
    }

    loadNodesFromDB() {
        try {
            const result = this.db.exec("SELECT * FROM nodes");
            if (result.length > 0) {
                this.nodes = result[0].values.map(row => {
                    const node = document.createElement('div');
                    node.className = 'node';
                    node.dataset.id = row[0];
                    node.style.left = `${row[2]}px`;
                    node.style.top = `${row[3]}px`;
                    
                    const content = document.createElement('div');
                    content.className = 'node-content';
                    content.textContent = row[1];
                    node.appendChild(content);
                    
                    this.container.appendChild(node);
                    return node;
                });
                
                if (this.nodes.length > 0) {
                    this.selectNode(this.nodes[0]);
                }
                
                this.attachNodeEvents();
                this.drawConnections();
            } else {
                this.createRootNode();
            }
        } catch (err) {
            console.error("Failed to load nodes from DB:", err);
            this.createRootNode();
        }
    }

    loadNodesFromLocalStorage() {
        const savedData = localStorage.getItem('mindmap');
        if (savedData) {
            try {
                const nodes = JSON.parse(savedData);
                nodes.forEach(node => {
                    const el = this.createNode(node.text, node.x, node.y, node.id);
                    this.nodes.push(el);
                });
                
                if (this.nodes.length > 0) {
                    this.selectNode(this.nodes[0]);
                }
                
                this.drawConnections();
            } catch (e) {
                this.createRootNode();
            }
        } else {
            this.createRootNode();
        }
    }

    saveNodesToDB() {
        if (!this.db) return;
        
        try {
            this.db.run("DELETE FROM nodes");
            
            const stmt = this.db.prepare(`
                INSERT INTO nodes (id, text, x, y, parent_id) 
                VALUES (?, ?, ?, ?, ?)
            `);
            
            this.nodes.forEach(node => {
                const rect = node.getBoundingClientRect();
                stmt.bind([
                    parseInt(node.dataset.id),
                    node.querySelector('.node-content').textContent,
                    rect.left,
                    rect.top,
                    node.dataset.parentId || null
                ]);
                stmt.step();
                stmt.reset();
            });
        } catch (err) {
            console.error("Failed to save to DB:", err);
            this.saveToLocalStorage();
        }
    }

    saveToLocalStorage() {
        const mapData = this.nodes.map(node => {
            const rect = node.getBoundingClientRect();
            return {
                id: node.dataset.id,
                text: node.querySelector('.node-content').textContent,
                x: rect.left,
                y: rect.top,
                parentId: node.dataset.parentId || null
            };
        });
        localStorage.setItem('mindmap', JSON.stringify(mapData));
    }

    createRootNode() {
        const root = this.createNode("Central Idea", window.innerWidth/2 - 70, 100);
        this.nodes.push(root);
        this.selectedNode = root;
        root.classList.add('selected');
    }

    createNode(text, x, y, id = null) {
        const node = document.createElement('div');
        node.className = 'node';
        node.dataset.id = id || this.idCounter++;
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        
        const content = document.createElement('div');
        content.className = 'node-content';
        content.textContent = text;
        content.contentEditable = false;
        
        node.appendChild(content);
        this.container.appendChild(node);
        
        // Event listeners
        node.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.editNode(node);
        });
        
        node.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e, node);
        });
        
        this.makeDraggable(node);
        return node;
    }

    makeDraggable(node) {
        let offsetX, offsetY, isDragging = false;
        
        node.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            
            isDragging = true;
            this.selectNode(node);
            
            const rect = node.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            
            node.style.zIndex = '100';
            node.style.transition = 'none';
            document.body.style.cursor = 'grabbing';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            node.style.left = `${e.clientX - offsetX}px`;
            node.style.top = `${e.clientY - offsetY}px`;
        });
        
        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            
            isDragging = false;
            node.style.zIndex = '';
            node.style.transition = '';
            document.body.style.cursor = '';
            this.saveNodesToDB();
            this.drawConnections();
        });
    }

    selectNode(node) {
        if (this.selectedNode) {
            this.selectedNode.classList.remove('selected');
        }
        this.selectedNode = node;
        node.classList.add('selected');
    }

    addNode(type) {
        if (!this.selectedNode) return;
        
        const rect = this.selectedNode.getBoundingClientRect();
        let x, y;
        
        if (type === 'child') {
            x = rect.left + 200;
            y = rect.top;
        } else { // sibling
            x = rect.left;
            y = rect.top + 120;
        }
        
        const node = this.createNode("New Node", x, y);
        // A sibling shares its selected node's parent; a child belongs to the selected node.
        const parentId = type === 'sibling'
            ? this.selectedNode.dataset.parentId
            : this.selectedNode.dataset.id;
        if (parentId) {
            node.dataset.parentId = parentId;
        }
        this.nodes.push(node);
        this.selectNode(node);
        this.saveNodesToDB();
        this.drawConnections();
    }

    editNode(node) {
        const content = node.querySelector('.node-content');
        content.contentEditable = true;
        content.focus();
        
        const range = document.createRange();
        range.selectNodeContents(content);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        
        content.addEventListener('blur', () => {
            content.contentEditable = false;
            this.saveNodesToDB();
            this.drawConnections();
        });
    }

    deleteNode(node) {
        if (!node || node.dataset.id === "1") return;
        
        // Recursively delete children
        const childNodes = this.nodes.filter(n => 
            n.dataset.parentId === node.dataset.id
        );
        childNodes.forEach(child => this.deleteNode(child));
        
        // Remove from array and DOM
        const index = this.nodes.findIndex(n => n === node);
        if (index !== -1) {
            this.nodes.splice(index, 1);
            node.remove();
            
            // Select root if no selection
            if (this.selectedNode === node) {
                this.selectedNode = this.nodes[0] || null;
                if (this.selectedNode) this.selectedNode.classList.add('selected');
            }
            
            this.saveNodesToDB();
            this.drawConnections();
        }
    }

    drawConnections() {
        const svg = document.getElementById('connections');
        svg.innerHTML = '';
        
        // Create arrowhead marker
        if (!document.getElementById('arrowhead')) {
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
            marker.setAttribute('id', 'arrowhead');
            marker.setAttribute('markerWidth', '10');
            marker.setAttribute('markerHeight', '7');
            marker.setAttribute('refX', '10');
            marker.setAttribute('refY', '3.5');
            marker.setAttribute('orient', 'auto');
            
            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
            polygon.setAttribute('fill', '#007AFF');
            
            marker.appendChild(polygon);
            defs.appendChild(marker);
            svg.appendChild(defs);
        }
        
        // Draw connections for each node to its parent
        this.nodes.forEach(node => {
            const parentId = node.dataset.parentId;
            if (!parentId) return;
            
            const parent = this.nodes.find(n => n.dataset.id === parentId);
            if (!parent) return;
            
            const start = parent.getBoundingClientRect();
            const end = node.getBoundingClientRect();
            
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', start.left + start.width/2);
            line.setAttribute('y1', start.top + start.height/2);
            line.setAttribute('x2', end.left + end.width/2);
            line.setAttribute('y2', end.top + end.height/2);
            line.setAttribute('stroke', '#007AFF');
            line.setAttribute('stroke-width', '2');
            line.setAttribute('stroke-dasharray', '5,3');
            line.setAttribute('marker-end', 'url(#arrowhead)');
            
            svg.appendChild(line);
        });
    }

    showContextMenu(e, node) {
        const menu = document.getElementById('context-menu');
        menu.style.display = 'block';
        menu.style.left = `${e.pageX}px`;
        menu.style.top = `${e.pageY}px`;
        
        this.selectNode(node);
        
        // Attach event handlers
        const menuItems = menu.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            item.onclick = () => {
                menu.style.display = 'none';
                this.handleContextAction(item.dataset.action, node);
            };
        });
        
        // Close menu when clicking elsewhere
        setTimeout(() => {
            document.addEventListener('click', function closeMenu() {
                menu.style.display = 'none';
                document.removeEventListener('click', closeMenu);
            });
        });
    }

    handleContextAction(action, node) {
        switch(action) {
            case 'add-child':
                this.addNode('child');
                break;
            case 'add-sibling':
                this.addNode('sibling');
                break;
            case 'edit':
                this.editNode(node);
                break;
            case 'delete':
                this.deleteNode(node);
                break;
        }
    }

    exportMap() {
        const mapData = this.nodes.map(node => {
            const rect = node.getBoundingClientRect();
            return {
                id: node.dataset.id,
                text: node.querySelector('.node-content').textContent,
                x: rect.left,
                y: rect.top,
                parentId: node.dataset.parentId || null
            };
        });
        
        const dataStr = JSON.stringify(mapData, null, 2);
        const blob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mindmap.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    importMap(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const mapData = JSON.parse(e.target.result);
                
                // Clear existing nodes
                this.nodes.forEach(node => node.remove());
                this.nodes = [];
                
                // Create new nodes
                mapData.forEach(node => {
                    const el = this.createNode(node.text, node.x, node.y, node.id);
                    if (node.parentId) {
                        el.dataset.parentId = node.parentId;
                    }
                    this.nodes.push(el);
                });
                
                // Select first node
                if (this.nodes.length > 0) {
                    this.selectNode(this.nodes[0]);
                }
                
                this.saveNodesToDB();
                this.drawConnections();
            } catch (err) {
                alert('Invalid map file: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    attachNodeEvents() {
        this.nodes.forEach(node => {
            node.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.editNode(node);
            });
            
            node.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showContextMenu(e, node);
            });
            
            this.makeDraggable(node);
        });
    }

    init() {
        // Toolbar events
        document.getElementById('add-child').addEventListener('click', () => this.addNode('child'));
        document.getElementById('add-sibling').addEventListener('click', () => this.addNode('sibling'));
        document.getElementById('save-map').addEventListener('click', () => this.exportMap());
        
        document.getElementById('load-map').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });
        
        document.getElementById('file-input').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.importMap(e.target.files[0]);
            }
        });
        
        // Canvas click to deselect
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container) {
                if (this.selectedNode) {
                    this.selectedNode.classList.remove('selected');
                    this.selectedNode = null;
                }
            }
        });
        
        // Initialize connections
        setTimeout(() => this.drawConnections(), 100);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const mindmap = new MindMap(document.getElementById('mindmap'));
});