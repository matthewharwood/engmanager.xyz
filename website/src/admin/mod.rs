use axum::{response::Html, Json};
use maud::html;

use crate::{load_homepage_blocks, save_homepage_blocks, HomepageData};

// ============================================================================
// Admin Routes
// ============================================================================

pub async fn admin_index() -> Html<String> {
    let markup = html! {
        html {
            head {
                meta charset="utf-8";
                title { "Admin" }
            }
            body {
                h1 { "Admin" }
                a href="/admin/route/" { "Go to admin/route/" }
            }
        }
    };
    Html(markup.into_string())
}

pub async fn admin_route_index() -> Html<String> {
    let markup = html! {
        html {
            head {
                meta charset="utf-8";
                title { "Admin Route" }
            }
            body {
                h1 { "Admin Route" }
                a href="/admin/route/homepage/" { "Go to admin/route/homepage/" }
            }
        }
    };
    Html(markup.into_string())
}

pub async fn admin_route_homepage() -> Html<String> {
    // Load current homepage blocks
    let blocks = load_homepage_blocks();
    let json = serde_json::to_string_pretty(&HomepageData { blocks }).unwrap_or_default();

    let markup = html! {
        html {
            head {
                meta charset="utf-8";
                title { "Edit Homepage" }
                style {
                    r#"
                    body {
                        font-family: system-ui, -apple-system, sans-serif;
                        max-width: 900px;
                        margin: 2rem auto;
                        padding: 0 1rem;
                        background: #0a0a0a;
                        color: #fff;
                    }
                    h1 {
                        margin-bottom: 2rem;
                    }

                    /* Tabs */
                    .tabs {
                        display: flex;
                        gap: 0.5rem;
                        margin-bottom: 2rem;
                        border-bottom: 2px solid #333;
                    }
                    .tab {
                        padding: 0.75rem 1.5rem;
                        background: transparent;
                        color: #666;
                        border: none;
                        border-bottom: 2px solid transparent;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: 600;
                        margin-bottom: -2px;
                        transition: all 0.2s;
                    }
                    .tab:hover {
                        color: #aaa;
                    }
                    .tab.active {
                        color: #fff;
                        border-bottom-color: #0070f3;
                    }
                    .tab-content {
                        display: none;
                    }
                    .tab-content.active {
                        display: block;
                    }

                    /* JSON View */
                    .form-group {
                        margin-bottom: 1.5rem;
                    }
                    label {
                        display: block;
                        margin-bottom: 0.5rem;
                        font-weight: 600;
                        color: #aaa;
                    }
                    textarea {
                        width: 100%;
                        min-height: 400px;
                        padding: 1rem;
                        font-family: 'Monaco', 'Menlo', monospace;
                        font-size: 14px;
                        background: #1a1a1a;
                        color: #fff;
                        border: 1px solid #333;
                        border-radius: 4px;
                        resize: vertical;
                    }
                    textarea:focus {
                        outline: none;
                        border-color: #666;
                    }

                    /* List View */
                    .block-list {
                        list-style: none;
                        padding: 0;
                        margin: 0 0 2rem 0;
                    }
                    .block-item {
                        background: #1a1a1a;
                        border: 1px solid #333;
                        border-radius: 4px;
                        padding: 1rem;
                        margin-bottom: 0.75rem;
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        gap: 1rem;
                    }
                    .block-info {
                        flex: 1;
                    }
                    .block-type {
                        font-weight: 600;
                        color: #0070f3;
                        margin-bottom: 0.5rem;
                    }
                    .block-props {
                        font-size: 14px;
                        color: #888;
                        font-family: 'Monaco', 'Menlo', monospace;
                    }
                    .block-actions {
                        display: flex;
                        gap: 0.5rem;
                    }
                    .btn-delete {
                        background: #ef4444;
                        color: white;
                        border: none;
                        padding: 0.5rem 1rem;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                    }
                    .btn-delete:hover {
                        background: #dc2626;
                    }
                    .add-block {
                        display: flex;
                        gap: 1rem;
                        align-items: center;
                        margin-bottom: 2rem;
                        padding: 1rem;
                        background: #1a1a1a;
                        border: 1px dashed #333;
                        border-radius: 4px;
                    }
                    .add-block select {
                        padding: 0.5rem;
                        background: #0a0a0a;
                        color: #fff;
                        border: 1px solid #333;
                        border-radius: 4px;
                        font-size: 14px;
                    }
                    .btn-add {
                        background: #10b981;
                        color: white;
                        border: none;
                        padding: 0.5rem 1.5rem;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                    }
                    .btn-add:hover {
                        background: #059669;
                    }

                    /* Buttons */
                    .button-group {
                        display: flex;
                        gap: 1rem;
                    }
                    button {
                        padding: 0.75rem 2rem;
                        font-size: 16px;
                        font-weight: 600;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    button[type="submit"] {
                        background: #0070f3;
                        color: white;
                    }
                    button[type="submit"]:hover {
                        background: #0060df;
                    }
                    button[type="button"] {
                        background: #333;
                        color: white;
                    }
                    button[type="button"]:hover {
                        background: #444;
                    }
                    .message {
                        padding: 1rem;
                        margin-top: 1rem;
                        border-radius: 4px;
                        display: none;
                    }
                    .message.success {
                        background: #10b981;
                        color: white;
                    }
                    .message.error {
                        background: #ef4444;
                        color: white;
                    }
                    .message.show {
                        display: block;
                    }
                    "#
                }
            }
            body {
                h1 { "Edit Homepage Content" }

                div class="tabs" {
                    button class="tab active" data-tab="list" { "List View" }
                    button class="tab" data-tab="json" { "JSON View" }
                }

                form id="homepage-form" {
                    // List View Tab
                    div class="tab-content active" id="list-view" {
                        div class="add-block" {
                            label { "Add Block: " }
                            select id="block-type-select" {
                                option value="Header" { "Header" }
                                option value="Hero" { "Hero" }
                            }
                            button type="button" class="btn-add" id="add-block-btn" { "+ Add Block" }
                        }

                        ul class="block-list" id="block-list" {}
                    }

                    // JSON View Tab
                    div class="tab-content" id="json-view" {
                        div class="form-group" {
                            label for="json-editor" { "Homepage JSON Data" }
                            textarea
                                id="json-editor"
                                name="json-data"
                                spellcheck="false"
                            {
                                (json)
                            }
                        }
                    }

                    div class="button-group" {
                        button type="submit" { "Publish Changes" }
                        a href="/" {
                            button type="button" { "Preview Homepage" }
                        }
                    }
                }

                div id="message" class="message" {}

                script {
                    "
                    const form = document.getElementById('homepage-form');
                    const messageDiv = document.getElementById('message');
                    const jsonEditor = document.getElementById('json-editor');
                    const blockList = document.getElementById('block-list');
                    let blocksData = { blocks: [] };

                    // Default empty block templates
                    const blockDefaults = {
                        Header: {
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

                        // Send to server
                        try {
                            const response = await fetch('/admin/api/homepage', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: jsonData
                            });

                            if (response.ok) {
                                showMessage('✓ Homepage updated successfully!', 'success');
                                // Update blocksData to reflect saved state
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
                    "
                }
            }
        }
    };
    Html(markup.into_string())
}

// ============================================================================
// API Endpoints
// ============================================================================

/// POST endpoint to update homepage.json
pub async fn update_homepage(Json(data): Json<HomepageData>) -> Result<&'static str, String> {
    match save_homepage_blocks(&data.blocks) {
        Ok(_) => Ok("Homepage updated successfully"),
        Err(e) => Err(format!("Failed to save: {}", e)),
    }
}
