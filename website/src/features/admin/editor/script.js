// Admin Editor JavaScript - Extracted from inline script
// Manages list/JSON view synchronization and form submission

const form = document.getElementById('homepage-form');
const messageDiv = document.getElementById('message');
const jsonEditor = document.getElementById('json-editor');
const blockList = document.getElementById('block-list');
const routeName = form.getAttribute('data-route-name') || 'homepage';
let blocksData = { blocks: [] };

// Default empty block templates
// Note: IDs will be generated server-side if not present
const blockDefaults = {
    Header: {
        id: '', // Empty ID - server will generate UUID
        type: 'Header',
        props: {
            headline: '',
            button: {
                href: '',
                text: '',
                aria_label: ''
            }
        }
    },
    Hero: {
        id: '', // Empty ID - server will generate UUID
        type: 'Hero',
        props: {
            headline: '',
            subheadline: ''
        }
    }
};

function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = 'message ' + type + ' show';
    setTimeout(function() {
        messageDiv.classList.remove('show');
    }, 5000);
}

// Tab switching
document.querySelectorAll('.tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
        const targetTab = this.getAttribute('data-tab');

        // Update active tab
        document.querySelectorAll('.tab').forEach(function(t) {
            t.classList.remove('active');
        });
        this.classList.add('active');

        // Update active content
        document.querySelectorAll('.tab-content').forEach(function(content) {
            content.classList.remove('active');
        });
        document.getElementById(targetTab + '-view').classList.add('active');

        // Sync data when switching tabs
        if (targetTab === 'json') {
            syncListToJson();
        } else if (targetTab === 'list') {
            syncJsonToList();
        }
    });
});

// Render block list
function renderBlockList() {
    blockList.innerHTML = '';

    blocksData.blocks.forEach(function(block, index) {
        const li = document.createElement('li');
        li.className = 'block-item';

        const info = document.createElement('div');
        info.className = 'block-info';

        const type = document.createElement('div');
        type.className = 'block-type';
        type.textContent = block.type;

        const props = document.createElement('div');
        props.className = 'block-props';
        props.textContent = JSON.stringify(block.props, null, 2);

        info.appendChild(type);
        info.appendChild(props);

        const actions = document.createElement('div');
        actions.className = 'block-actions';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.textContent = 'Delete';
        deleteBtn.type = 'button';
        deleteBtn.onclick = function() {
            deleteBlock(index);
        };

        actions.appendChild(deleteBtn);

        li.appendChild(info);
        li.appendChild(actions);
        blockList.appendChild(li);
    });
}

// Add block
document.getElementById('add-block-btn').addEventListener('click', function() {
    const blockType = document.getElementById('block-type-select').value;
    const newBlock = JSON.parse(JSON.stringify(blockDefaults[blockType]));
    blocksData.blocks.push(newBlock);
    renderBlockList();
    syncListToJson();
});

// Delete block
function deleteBlock(index) {
    blocksData.blocks.splice(index, 1);
    renderBlockList();
    syncListToJson();
}

// Sync list to JSON
function syncListToJson() {
    jsonEditor.value = JSON.stringify(blocksData, null, 2);
}

// Sync JSON to list
function syncJsonToList() {
    try {
        blocksData = JSON.parse(jsonEditor.value);
        renderBlockList();
    } catch (err) {
        showMessage('Invalid JSON, cannot sync to list view', 'error');
    }
}

// Form submission
form.addEventListener('submit', async function(e) {
    e.preventDefault();

    // Sync based on active tab
    const activeTab = document.querySelector('.tab.active').getAttribute('data-tab');

    if (activeTab === 'list') {
        // If on list view, sync list to JSON
        syncListToJson();
    } else {
        // If on JSON view, sync JSON to list (update blocksData)
        try {
            blocksData = JSON.parse(jsonEditor.value);
        } catch (err) {
            showMessage('Invalid JSON: ' + err.message, 'error');
            return;
        }
    }

    const jsonData = jsonEditor.value;

    // Validate JSON
    try {
        JSON.parse(jsonData);
    } catch (err) {
        showMessage('Invalid JSON: ' + err.message, 'error');
        return;
    }

    // Send to server using dynamic route name
    try {
        const response = await fetch('/admin/api/' + routeName, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: jsonData
        });

        if (response.ok) {
            const responseText = await response.text();
            showMessage('✓ ' + responseText, 'success');
            // Update blocksData to reflect saved state
            // Parse the response to get the IDs that were generated server-side
            blocksData = JSON.parse(jsonData);
            renderBlockList();
        } else {
            const errorText = await response.text();
            showMessage('Failed to update: ' + errorText, 'error');
        }
    } catch (err) {
        showMessage('Network error: ' + err.message, 'error');
    }
});

// Initialize on load
window.addEventListener('load', function() {
    try {
        blocksData = JSON.parse(jsonEditor.value);
        renderBlockList();
    } catch (err) {
        showMessage('Failed to load initial data', 'error');
    }
});
