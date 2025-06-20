class MindMap {
    constructor(container) {
        this.container = container;
        this.nodes = [];
        this.selectedNode = null;
        this.idCounter = 1;
        this.init();
    }

    init() {
        this.createRootNode();
        this.setupEventListeners();
    }

    createRootNode() {
        const root = this.createNode("Central Idea", window.innerWidth/2 - 60, 100);
        this.nodes.push(root);
        this.selectedNode = root;
        root.classList.add('selected');
    }

    createNode(text, x, y) {
        const node = document.createElement('div');
        node.className = 'node';
        node.dataset.id = this.idCounter++;
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;

        const content = document.createElement('div');
        content.className = 'node-content';
        content.textContent = text;
        content.contentEditable = false;

        node.appendChild(content);
        this.container.appendChild(node);

        // Event listeners
        node.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectNode(node);
        });

        return node;
    }

    selectNode(node) {
        if (this.selectedNode) {
            this.selectedNode.classList.remove('selected');
        }
        this.selectedNode = node;
        node.classList.add('selected');
    }

    addChildNode() {
        if (!this.selectedNode) return;

        const rect = this.selectedNode.getBoundingClientRect();
        const x = rect.left + 200;
        const y = rect.top;

        const child = this.createNode("New Node", x, y);
        this.nodes.push(child);
        this.selectNode(child);
        this.drawConnections();
    }

    editSelectedNode() {
        if (!this.selectedNode) return;
        const content = this.selectedNode.querySelector('.node-content');
        content.contentEditable = true;
        content.focus();

        // Save on blur
        content.addEventListener('blur', () => {
            content.contentEditable = false;
            this.drawConnections();
        });
    }

    deleteSelectedNode() {
        if (!this.selectedNode || this.selectedNode.dataset.id === "1") return;

        const index = this.nodes.findIndex(n => n === this.selectedNode);
        if (index !== -1) {
            this.nodes.splice(index, 1);
            this.selectedNode.remove();
            this.selectedNode = this.nodes[0] || null;
            if (this.selectedNode) this.selectedNode.classList.add('selected');
            this.drawConnections();
        }
    }

    drawConnections() {
        const svg = document.getElementById('connections');
        svg.innerHTML = '';

        this.nodes.forEach(node => {
            if (node === this.nodes[0]) return; // Skip root

            const start = this.nodes[0].getBoundingClientRect();
            const end = node.getBoundingClientRect();

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', start.left + start.width/2);
            line.setAttribute('y1', start.top + start.height/2);
            line.setAttribute('x2', end.left + end.width/2);
            line.setAttribute('y2', end.top + end.height/2);
            line.setAttribute('stroke', '#3498db');
            line.setAttribute('stroke-width', '2');
            line.setAttribute('marker-end', 'url(#arrowhead)');

            svg.appendChild(line);
        });

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
            polygon.setAttribute('fill', '#3498db');

            marker.appendChild(polygon);
            defs.appendChild(marker);
            svg.appendChild(defs);
        }
    }

    setupEventListeners() {
        document.getElementById('add-child').addEventListener('click', () => this.addChildNode());
        document.getElementById('edit-node').addEventListener('click', () => this.editSelectedNode());
        document.getElementById('delete-node').addEventListener('click', () => this.deleteSelectedNode());
        document.getElementById('save-map').addEventListener('click', () => this.saveMap());

        // Canvas click to deselect
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container) {
                if (this.selectedNode) {
                    this.selectedNode.classList.remove('selected');
                    this.selectedNode = null;
                }
            }
        });
    }

    saveMap() {
        const mapData = this.nodes.map(node => ({
            id: node.dataset.id,
            text: node.querySelector('.node-content').textContent,
            x: parseInt(node.style.left),
            y: parseInt(node.style.top)
        }));

        const blob = new Blob([JSON.stringify(mapData)], {type: 'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'mindmap.json';
        a.click();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const mindmap = new MindMap(document.getElementById('mindmap'));
    window.mindmap = mindmap; // Make accessible for debugging
});
