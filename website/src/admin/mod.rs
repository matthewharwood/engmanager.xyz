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

                form id="homepage-form" {
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

                    function showMessage(text, type) {
                        messageDiv.textContent = text;
                        messageDiv.className = 'message ' + type + ' show';
                        setTimeout(function() {
                            messageDiv.classList.remove('show');
                        }, 5000);
                    }

                    form.addEventListener('submit', async function(e) {
                        e.preventDefault();

                        const jsonData = document.getElementById('json-editor').value;

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
                            } else {
                                const errorText = await response.text();
                                showMessage('Failed to update: ' + errorText, 'error');
                            }
                        } catch (err) {
                            showMessage('Network error: ' + err.message, 'error');
                        }
                    });

                    // Format JSON on load
                    window.addEventListener('load', function() {
                        const textarea = document.getElementById('json-editor');
                        try {
                            const parsed = JSON.parse(textarea.value);
                            textarea.value = JSON.stringify(parsed, null, 2);
                        } catch (err) {
                            // Already formatted
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
