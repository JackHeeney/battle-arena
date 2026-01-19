export class GameMenu {
    constructor() {
        this.container = document.createElement('div');
        this.container.style.position = 'fixed';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.alignItems = 'center';
        this.container.style.justifyContent = 'center';
        this.container.style.zIndex = '1000';
        this.container.style.color = 'white';
        this.container.style.fontFamily = 'Arial, sans-serif';

        this.classButtons = [];
        this.matchmakingButton = null;
        this.isMatchmaking = false;

        this.createTitle();
        this.createClassSelection();
        this.createMatchmakingButton();
        this.createStatusMessage();
    }

    createTitle() {
        const title = document.createElement('h1');
        title.textContent = 'Battle Arena';
        title.style.fontSize = '48px';
        title.style.marginBottom = '40px';
        title.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
        this.container.appendChild(title);
    }

    createClassSelection() {
        const classContainer = document.createElement('div');
        classContainer.style.display = 'flex';
        classContainer.style.gap = '20px';
        classContainer.style.marginBottom = '40px';

        const classes = [
            { name: 'Mage', color: '#4a90e2' },
            { name: 'Hunter', color: '#50e3c2' },
            { name: 'Warrior', color: '#e35050' }
        ];

        classes.forEach(cls => {
            const button = document.createElement('button');
            button.textContent = cls.name;
            button.style.padding = '15px 30px';
            button.style.fontSize = '24px';
            button.style.border = 'none';
            button.style.borderRadius = '5px';
            button.style.backgroundColor = cls.color;
            button.style.color = 'white';
            button.style.cursor = 'pointer';
            button.style.transition = 'transform 0.2s';
            button.onmouseover = () => button.style.transform = 'scale(1.1)';
            button.onmouseout = () => button.style.transform = 'scale(1)';
            button.onclick = () => this.selectClass(cls.name);
            classContainer.appendChild(button);
            this.classButtons.push(button);
        });

        this.container.appendChild(classContainer);
    }

    createMatchmakingButton() {
        this.matchmakingButton = document.createElement('button');
        this.matchmakingButton.textContent = 'Find Match';
        this.matchmakingButton.style.padding = '15px 40px';
        this.matchmakingButton.style.fontSize = '24px';
        this.matchmakingButton.style.border = 'none';
        this.matchmakingButton.style.borderRadius = '5px';
        this.matchmakingButton.style.backgroundColor = '#2ecc71';
        this.matchmakingButton.style.color = 'white';
        this.matchmakingButton.style.cursor = 'pointer';
        this.matchmakingButton.style.transition = 'transform 0.2s';
        this.matchmakingButton.onmouseover = () => this.matchmakingButton.style.transform = 'scale(1.1)';
        this.matchmakingButton.onmouseout = () => this.matchmakingButton.style.transform = 'scale(1)';
        this.matchmakingButton.onclick = () => this.startMatchmaking();
        this.container.appendChild(this.matchmakingButton);
    }

    createStatusMessage() {
        this.statusMessage = document.createElement('div');
        this.statusMessage.style.marginTop = '20px';
        this.statusMessage.style.fontSize = '18px';
        this.statusMessage.style.color = '#ecf0f1';
        this.container.appendChild(this.statusMessage);
    }

    selectClass(className) {
        if (this.isMatchmaking) return;
        console.log('Class selected:', className);
        this.selectedClass = className;
        this.updateStatusMessage(`Selected class: ${className}`);
    }

    startMatchmaking() {
        if (!this.selectedClass || this.isMatchmaking) return;

        this.isMatchmaking = true;
        console.log('Starting matchmaking for class:', this.selectedClass);
        this.updateStatusMessage('Finding players...');

        // Disable all buttons
        this.classButtons.forEach(button => {
            button.disabled = true;
            button.style.opacity = '0.5';
        });
        this.matchmakingButton.disabled = true;
        this.matchmakingButton.style.opacity = '0.5';

        // Hide menu first
        this.hide();

        // Emit matchmaking event
        window.socket.emit('startMatchmaking', { class: this.selectedClass });
    }

    updateStatusMessage(message) {
        this.statusMessage.textContent = message;
    }

    show() {
        console.log('Showing menu');
        if (this.container.parentNode) {
            console.log('Menu already in DOM, removing first');
            this.container.parentNode.removeChild(this.container);
        }
        document.body.appendChild(this.container);
        console.log('Menu added to DOM');
    }

    hide() {
        console.log('Hiding menu');
        console.log('Menu container exists:', !!this.container);
        console.log('Menu container parent:', this.container.parentNode);
        if (this.container.parentNode) {
            console.log('Removing menu from DOM');
            this.container.parentNode.removeChild(this.container);
            console.log('Menu removed from DOM');
        } else {
            console.log('Menu container not found in DOM');
        }
        // Force remove if still present
        if (this.container.parentNode) {
            console.log('Force removing menu from DOM');
            this.container.parentNode.removeChild(this.container);
        }
    }
} 