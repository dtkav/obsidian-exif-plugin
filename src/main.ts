import { requestUrl, TFile, Plugin, MarkdownPostProcessorContext, ItemView, WorkspaceLeaf, View } from 'obsidian';
import { ExifImage } from 'exif';

const VIEW_TYPE_IMAGE_CLICK = "image-click-view";

class ImageClickView extends ItemView {
    contentEl: HTMLElement;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return VIEW_TYPE_IMAGE_CLICK;
    }

    getDisplayText(): string {
        return "Image Click Logger";
    }

    getIcon(): string {
        return "image";
    }

    async onOpen() {
        this.contentEl = this.containerEl.children[1].createDiv();
    }

    async onClose() {
        // Cleanup if necessary
    }

    renderMetadataComponent(metadata: any): HTMLElement {
        console.log("exif!", metadata);
	const container = document.createElement('div')
        //const imageContainer = document.createElement('div');
	//imageContainer.innerHTML = image.outerHTML;
        const metadataContainer = document.createElement('div');
        metadataContainer.className = 'metadata-container';
    
        for (const sectionName in metadata) {
	    console.log(sectionName);
            const section = metadata[sectionName];
            const sectionDiv = document.createElement('div');
            sectionDiv.className = 'metadata-section';
            const sectionTitle = document.createElement('h2');
            sectionTitle.textContent = sectionName;
            sectionDiv.appendChild(sectionTitle);
    
            const sectionTable = document.createElement('table');
            for (const key in section) {
                const value = section[key];
                const row = document.createElement('tr');
                
                const keyCell = document.createElement('td');
                keyCell.textContent = key;
                row.appendChild(keyCell);
                
                const valueCell = document.createElement('td');
                if (Buffer.isBuffer(value)) {
                    valueCell.textContent = value.toString('hex');
                } else {
                    valueCell.textContent = String(value);
                }
                row.appendChild(valueCell);
    
                sectionTable.appendChild(row);
            }
            sectionDiv.appendChild(sectionTable);
            metadataContainer.appendChild(sectionDiv);
        }
	//container.appendChild(imageContainer);
	container.appendChild(metadataContainer);
	console.log(container)
        return container;
    }

    remoteOpen(image: HTMLImageElement, contentEl: HTMLElement, activateView: () => void, cb: (arrayBuffer: ArrayBuffer, contentEl: HTMLElement, activateView: () => void) => void): void {
	console.log("remote open")
        requestUrl({url: image.src})
            .then(response => response.arrayBuffer)
            .then(buffer => {
                try {
	            console.log("calling callback")
		    cb(buffer, contentEl, activateView);
                } catch (error) {
                    console.error('Error:', error.message);
                }
            })
            .catch(error => console.error('Request error:', error));
    }


    localOpen(contentEl: HTMLElement, activateView: () => void, cb: (arrayBuffer: ArrayBuffer, contentEl: HTMLElement, activateView: () => void) => void): void {
	console.log("local open")
	const file = this.app.workspace.getActiveFile();
	if (!file) {
	    console.log("no file!");
	} else {
	    console.log(this.app.vault)
	    this.app.vault.readBinary(file).then((buffer) => {
                if (buffer instanceof ArrayBuffer) {
                    try {
	        	console.log("calling callback")
	        	cb(buffer, contentEl, activateView);
                    } catch (error) {
                        console.error('Error:', error.message);
                    }
                } else {
                    console.error('Could not read blob as ArrayBuffer');
                }
	    });
	}
    }

    parseMetadata(arrayBuffer: ArrayBuffer, contentEl: HTMLElement, activateView: () => void): void {
	console.log("parse metadata")
        new ExifImage({ image : Buffer.from(arrayBuffer) }, (error, exifData) => {
	    console.log("error: ", error)
	    console.log("exif: ", exifData)
	    if (exifData === undefined) {
                contentEl.innerHTML = "";
		return;
	    }
	    console.log("exif: ", exifData)
            const content = this.renderMetadataComponent(exifData);
	    activateView();
	    console.log("painting content")
	    console.log(content)
            contentEl.innerHTML = "";
            contentEl.appendChild(content);
        });
    }

    onImageClick(image: HTMLImageElement, activateView: () => void) {
	if (image.src && image.src.startsWith("http")) {
	    this.remoteOpen(image, this.contentEl, activateView, this.parseMetadata.bind(this));
	} else {
	    this.localOpen(this.contentEl, activateView, this.parseMetadata.bind(this));
        }

    }

    update() {
	this.localOpen(this.contentEl, () => {}, this.parseMetadata.bind(this));
    }
}

export default class ImageClickLogger extends Plugin {
 
    clickHandler(event: Event) {
	console.log("got event!")
        const target = event.target as HTMLElement;
        if (target.tagName.toLowerCase() === 'img') {
            const img = target as HTMLImageElement;
	    console.log("event was an image!")
	    console.log(img);
            this.handleImageClick(img);
        }
    };


    onload() {
        this.registerView(
            VIEW_TYPE_IMAGE_CLICK,
            (leaf: WorkspaceLeaf) => new ImageClickView(leaf)
        );


    	this.registerMarkdownPostProcessor((el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
            const images = el.querySelectorAll('img');
            images.forEach(img => {
                img.addEventListener('click', this.clickHandler.bind(this));
            });
        });

        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                this.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
                    if (leaf.getViewState()?.type === 'image') {
                        const images = leaf.view.containerEl.querySelectorAll('img');
                        images.forEach(img => {
                            img.addEventListener('click', this.clickHandler.bind(this));
                        });

 
                        const imageClickView = this.app.workspace.getLeavesOfType(VIEW_TYPE_IMAGE_CLICK)[0];
                        if (imageClickView) {
                            const view = imageClickView.view;
                            if (view instanceof ImageClickView) {
                                view.update();
                            }
                        }


                    }
                });
            })
        );
        //document.addEventListener('click', this.clickHandler);

    }

    onunload() {
        // Cleanup actions when the plugin is unloaded
	//document.off('click', '', this.clickHandler)
    }

    async activateView() {
        let { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        let leaves = workspace.getLeavesOfType(VIEW_TYPE_IMAGE_CLICK);

        if (leaves.length > 0) {
            // A leaf with our view already exists, use that
            leaf = leaves[0];
        } else {
            // Our view could not be found in the workspace, create a new leaf
            // in the right sidebar for it
            leaf = workspace.getRightLeaf(false);
            await leaf.setViewState({ type: VIEW_TYPE_IMAGE_CLICK, active: true });
        }

        // "Reveal" the leaf in case it is in a collapsed sidebar
        workspace.revealLeaf(leaf);
    }

    handleImageClick(image: HTMLImageElement) {

	console.log("handleImageClick")
	console.log(image)

        if (!image) return;

    
        const imageClickView = this.app.workspace.getLeavesOfType(VIEW_TYPE_IMAGE_CLICK)[0];
        if (imageClickView) {
            const view = imageClickView.view;
            if (view instanceof ImageClickView) {
                view.onImageClick(image, this.activateView.bind(this));
            }
        }
    }
}
