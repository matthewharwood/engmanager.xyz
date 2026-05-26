#[cfg(not(target_arch = "wasm32"))]
pub fn crate_name() -> &'static str {
    env!("CARGO_PKG_NAME")
}

#[cfg(target_arch = "wasm32")]
mod web {
    use std::cell::RefCell;
    use std::f32::consts::PI;
    use std::rc::Rc;

    use glam::{Mat4, Quat, Vec3};
    use wasm_bindgen::{JsCast, JsValue, closure::Closure, prelude::*};
    use web_sys::HtmlCanvasElement;
    use wisp::application::{AppConfig, Application};
    use wisp_3d::{
        Camera3D, EdgesMesh, LineColor, MaterialRenderer, Mesh3D, PaletteRampMaterial, Sprite3D,
        SpritePipeline, WireframePipeline,
    };

    const SCREEN_REV: &str = "284c834c6a3567c893968a17a1176a3c05ef828a";
    const MAX_DPR: f64 = 2.0;
    const DEFAULT_STOPS: [[f32; 4]; 5] = [
        [0.996, 0.392, 0.043, 1.0],
        [0.902, 0.271, 0.325, 1.0],
        [0.918, 0.463, 0.796, 1.0],
        [0.533, 0.224, 0.937, 1.0],
        [0.118, 0.4, 0.961, 1.0],
    ];

    thread_local! {
        static THEME_STOPS: RefCell<[[f32; 4]; 5]> = const { RefCell::new(DEFAULT_STOPS) };
    }

    #[wasm_bindgen]
    pub fn set_theme_palette(c0: String, c1: String, c2: String, c3: String, c4: String) {
        let colors = [c0, c1, c2, c3, c4];
        THEME_STOPS.with(|stops| {
            let mut stops = stops.borrow_mut();
            for (index, color) in colors.iter().enumerate() {
                stops[index] = parse_css_color(color).unwrap_or(DEFAULT_STOPS[index]);
            }
        });
    }

    #[wasm_bindgen(start)]
    pub fn start() -> Result<(), JsValue> {
        console_error_panic_hook::set_once();
        let _ = console_log::init_with_level(log::Level::Info);

        let window = web_sys::window().ok_or_else(|| JsValue::from_str("no window"))?;
        let document = window
            .document()
            .ok_or_else(|| JsValue::from_str("no document"))?;
        let canvas: HtmlCanvasElement = document
            .query_selector("canvas[data-404-stage]")
            .ok()
            .flatten()
            .ok_or_else(|| JsValue::from_str("no 404 canvas"))?
            .dyn_into()
            .map_err(|_| JsValue::from_str("404 stage is not a canvas"))?;

        let failure_canvas = canvas.clone();
        wasm_bindgen_futures::spawn_local(async move {
            match Renderer::new(canvas).await {
                Ok(renderer) => start_loop(renderer),
                Err(error) => signal_failure(&failure_canvas, &error),
            }
        });

        log::info!("not-found-wisp booted from Screen Wisp3D rev {SCREEN_REV}");
        Ok(())
    }

    struct Renderer {
        canvas: HtmlCanvasElement,
        surface: wgpu::Surface<'static>,
        app: Application,
        config: wgpu::SurfaceConfiguration,
        surface_format: wgpu::TextureFormat,
        material_renderer: MaterialRenderer,
        wireframe: WireframePipeline,
        sprite_pipeline: SpritePipeline,
        camera: Camera3D,
        depth_texture: wgpu::Texture,
        depth_view: wgpu::TextureView,
        pyramid: Mesh3D,
        edges: EdgesMesh,
        edge_vbuf: wgpu::Buffer,
        edge_color_buf: wgpu::Buffer,
        edge_color_bg: wgpu::BindGroup,
        base_glow: Mesh3D,
        eye_glow: Mesh3D,
        eye_ring: Mesh3D,
        pupil: Mesh3D,
        width: u32,
        height: u32,
        reduced_motion: bool,
    }

    impl Renderer {
        async fn new(canvas: HtmlCanvasElement) -> Result<Self, String> {
            let (width, height) = apply_canvas_size(&canvas);
            let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
                backends: wgpu::Backends::BROWSER_WEBGPU,
                ..Default::default()
            });
            let surface = instance
                .create_surface(wgpu::SurfaceTarget::Canvas(canvas.clone()))
                .map_err(|error| format!("create_surface: {error}"))?;
            let adapter = instance
                .request_adapter(&wgpu::RequestAdapterOptions {
                    power_preference: wgpu::PowerPreference::HighPerformance,
                    force_fallback_adapter: false,
                    compatible_surface: Some(&surface),
                })
                .await
                .ok_or_else(|| "no WebGPU adapter available".to_owned())?;
            let (device, queue) = adapter
                .request_device(
                    &wgpu::DeviceDescriptor {
                        label: Some("not-found-wisp device"),
                        required_features: wgpu::Features::empty(),
                        required_limits: wgpu::Limits::downlevel_defaults(),
                        memory_hints: wgpu::MemoryHints::Performance,
                    },
                    None,
                )
                .await
                .map_err(|error| format!("request_device: {error}"))?;

            let caps = surface.get_capabilities(&adapter);
            let surface_format = caps
                .formats
                .first()
                .copied()
                .ok_or_else(|| "surface has no supported formats".to_owned())?;
            let alpha_mode = if caps
                .alpha_modes
                .contains(&wgpu::CompositeAlphaMode::PreMultiplied)
            {
                wgpu::CompositeAlphaMode::PreMultiplied
            } else {
                caps.alpha_modes
                    .first()
                    .copied()
                    .ok_or_else(|| "surface has no supported alpha modes".to_owned())?
            };
            let config = wgpu::SurfaceConfiguration {
                usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
                format: surface_format,
                width,
                height,
                present_mode: wgpu::PresentMode::Fifo,
                alpha_mode,
                view_formats: vec![],
                desired_maximum_frame_latency: 2,
            };
            surface.configure(&device, &config);

            let app =
                Application::from_wgpu(instance, adapter, device, queue, AppConfig::default());
            let aspect = (width as f32) / (height.max(1) as f32);
            let mut camera = Camera3D::perspective(38.0, aspect, 0.1, 100.0);
            camera.position = Vec3::new(0.0, 0.28, 6.2);

            let (depth_texture, depth_view) = make_depth(app.device(), width, height);
            let pyramid = Mesh3D::pyramid(1.34, 1.25);
            let edges = EdgesMesh::from_mesh(&pyramid, 8.0);
            let material_renderer = MaterialRenderer::new(&app);
            let wireframe = WireframePipeline::new(&app, surface_format, 1);
            let sprite_pipeline = SpritePipeline::new(&app, surface_format, 1);
            let edge_vbuf = wireframe.build_vertex_buffer(app.device(), app.queue(), &edges);
            let (edge_color_buf, edge_color_bg) = wireframe.build_color_resources(
                app.device(),
                app.queue(),
                LineColor {
                    color: [0.96, 0.88, 0.86, 0.82],
                },
            );

            Ok(Self {
                canvas,
                surface,
                app,
                config,
                surface_format,
                material_renderer,
                wireframe,
                sprite_pipeline,
                camera,
                depth_texture,
                depth_view,
                pyramid,
                edges,
                edge_vbuf,
                edge_color_buf,
                edge_color_bg,
                base_glow: Sprite3D::circle(1.65, 72),
                eye_glow: Sprite3D::circle(0.35, 48),
                eye_ring: Sprite3D::ring(0.11, 0.18, 48),
                pupil: Sprite3D::circle(0.055, 32),
                width,
                height,
                reduced_motion: prefers_reduced_motion(),
            })
        }

        fn render(&mut self, now_ms: f64) -> Result<(), String> {
            self.resize_if_needed();

            let frame = match self.surface.get_current_texture() {
                Ok(frame) => frame,
                Err(wgpu::SurfaceError::Lost | wgpu::SurfaceError::Outdated) => {
                    self.configure_surface();
                    return Ok(());
                }
                Err(wgpu::SurfaceError::Timeout) => return Ok(()),
                Err(wgpu::SurfaceError::OutOfMemory) => {
                    return Err("WebGPU surface ran out of memory".to_owned());
                }
                Err(error) => return Err(format!("get_current_texture: {error}")),
            };
            let color_view = frame
                .texture
                .create_view(&wgpu::TextureViewDescriptor::default());
            let mut encoder =
                self.app
                    .device()
                    .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                        label: Some("not-found-wisp encoder"),
                    });

            let elapsed = (now_ms * 0.001) as f32;
            let scale = scene_scale(&self.canvas);
            let spin = if self.reduced_motion {
                -0.42
            } else {
                elapsed * 0.22
            };
            let model = Mat4::from_scale_rotation_translation(
                Vec3::splat(scale),
                Quat::from_rotation_y(spin) * Quat::from_rotation_x(-0.08),
                Vec3::ZERO,
            );
            let material = themed_material(elapsed);

            self.material_renderer.draw_one(
                &self.app,
                &mut encoder,
                &color_view,
                &self.depth_view,
                &self.camera,
                &material,
                &self.pyramid,
                model,
                [1.0, 1.0, 1.0, 0.98],
                wgpu::Color::TRANSPARENT,
                self.surface_format,
                1,
            );
            self.draw_wireframe(&mut encoder, &color_view);
            self.draw_sprites(&mut encoder, &color_view, model, elapsed);

            self.app.queue().submit(std::iter::once(encoder.finish()));
            frame.present();
            let _ = &self.depth_texture;
            let _ = &self.edge_color_buf;
            Ok(())
        }

        fn draw_wireframe(
            &mut self,
            encoder: &mut wgpu::CommandEncoder,
            color_view: &wgpu::TextureView,
        ) {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("not-found-wisp wireframe pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: color_view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Load,
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachment {
                    view: &self.depth_view,
                    depth_ops: Some(wgpu::Operations {
                        load: wgpu::LoadOp::Load,
                        store: wgpu::StoreOp::Store,
                    }),
                    stencil_ops: None,
                }),
                timestamp_writes: None,
                occlusion_query_set: None,
            });
            self.wireframe.draw_into(
                &self.app,
                &mut pass,
                &self.camera,
                &self.edges,
                LineColor {
                    color: [0.96, 0.88, 0.86, 0.82],
                },
                &self.edge_vbuf,
                &self.edge_color_bg,
            );
        }

        fn draw_sprites(
            &mut self,
            encoder: &mut wgpu::CommandEncoder,
            color_view: &wgpu::TextureView,
            model: Mat4,
            elapsed: f32,
        ) {
            let base_model = model
                * Mat4::from_scale_rotation_translation(
                    Vec3::ONE,
                    Quat::from_rotation_x(-PI / 2.0),
                    Vec3::new(0.0, -1.18, 0.0),
                );
            self.sprite_pipeline.draw_one(
                &self.app,
                encoder,
                color_view,
                &self.depth_view,
                &self.camera,
                &self.base_glow,
                base_model,
                [0.12, 0.4, 0.96, 0.10],
            );

            let eye_model = model
                * Mat4::from_scale_rotation_translation(
                    Vec3::ONE,
                    Quat::from_rotation_x(-0.45),
                    Vec3::new(0.0, -0.02, 0.79),
                );
            let pulse = 0.84 + (elapsed * 1.6).sin() * 0.12;
            self.sprite_pipeline.draw_one(
                &self.app,
                encoder,
                color_view,
                &self.depth_view,
                &self.camera,
                &self.eye_glow,
                eye_model
                    * Mat4::from_scale_rotation_translation(
                        Vec3::new(1.55, 0.48, 1.0),
                        Quat::IDENTITY,
                        Vec3::new(0.0, 0.0, 0.012),
                    ),
                [0.996, 0.392, 0.043, 0.22],
            );
            self.sprite_pipeline.draw_one(
                &self.app,
                encoder,
                color_view,
                &self.depth_view,
                &self.camera,
                &self.eye_ring,
                eye_model
                    * Mat4::from_scale_rotation_translation(
                        Vec3::new(1.78, 0.58, 1.0),
                        Quat::IDENTITY,
                        Vec3::new(0.0, 0.0, 0.018),
                    ),
                [0.976, 0.886, 0.686, pulse.clamp(0.72, 0.96)],
            );
            self.sprite_pipeline.draw_one(
                &self.app,
                encoder,
                color_view,
                &self.depth_view,
                &self.camera,
                &self.pupil,
                eye_model
                    * Mat4::from_scale_rotation_translation(
                        Vec3::new(1.0, 1.2, 1.0),
                        Quat::IDENTITY,
                        Vec3::new(0.0, 0.0, 0.026),
                    ),
                [0.067, 0.067, 0.106, 0.9],
            );
        }

        fn resize_if_needed(&mut self) {
            let (width, height) = apply_canvas_size(&self.canvas);
            if width == self.width && height == self.height {
                return;
            }
            self.width = width;
            self.height = height;
            self.config.width = width;
            self.config.height = height;
            self.configure_surface();
            let (depth_texture, depth_view) = make_depth(self.app.device(), width, height);
            self.depth_texture = depth_texture;
            self.depth_view = depth_view;
            self.camera.update_aspect(width, height);
        }

        fn configure_surface(&self) {
            self.surface.configure(self.app.device(), &self.config);
        }
    }

    fn start_loop(renderer: Renderer) {
        let renderer = Rc::new(RefCell::new(renderer));
        let callback: Rc<RefCell<Option<Closure<dyn FnMut(f64)>>>> = Rc::new(RefCell::new(None));
        let next_callback = Rc::clone(&callback);
        let loop_renderer = Rc::clone(&renderer);

        *next_callback.borrow_mut() = Some(Closure::wrap(Box::new(move |now| {
            let keep_running = {
                let mut renderer = loop_renderer.borrow_mut();
                match renderer.render(now) {
                    Ok(()) => true,
                    Err(error) => {
                        signal_failure(&renderer.canvas, &error);
                        false
                    }
                }
            };
            if keep_running {
                if let Some(callback) = callback.borrow().as_ref() {
                    request_animation_frame(callback);
                }
            }
        }) as Box<dyn FnMut(f64)>));

        if let Some(callback) = next_callback.borrow().as_ref() {
            request_animation_frame(callback);
        }
    }

    fn request_animation_frame(callback: &Closure<dyn FnMut(f64)>) {
        if let Some(window) = web_sys::window() {
            let _ = window.request_animation_frame(callback.as_ref().unchecked_ref());
        }
    }

    fn apply_canvas_size(canvas: &HtmlCanvasElement) -> (u32, u32) {
        let dpr = web_sys::window()
            .map(|window| window.device_pixel_ratio().clamp(1.0, MAX_DPR))
            .unwrap_or(1.0);
        let css_width = f64::from(canvas.client_width().max(1));
        let css_height = f64::from(canvas.client_height().max(1));
        let width = (css_width * dpr).round().max(1.0) as u32;
        let height = (css_height * dpr).round().max(1.0) as u32;
        canvas.set_width(width);
        canvas.set_height(height);
        (width, height)
    }

    fn scene_scale(canvas: &HtmlCanvasElement) -> f32 {
        let width = canvas.client_width().max(1) as f32;
        let height = canvas.client_height().max(1) as f32;
        (width.min(height) / 520.0).clamp(0.86, 1.45)
    }

    fn make_depth(
        device: &wgpu::Device,
        width: u32,
        height: u32,
    ) -> (wgpu::Texture, wgpu::TextureView) {
        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("not-found-wisp depth"),
            size: wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wisp_3d::DEPTH_FORMAT,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        });
        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
        (texture, view)
    }

    fn prefers_reduced_motion() -> bool {
        web_sys::window()
            .and_then(|window| {
                window
                    .match_media("(prefers-reduced-motion: reduce)")
                    .ok()
                    .flatten()
            })
            .map(|query| query.matches())
            .unwrap_or(false)
    }

    fn signal_failure(canvas: &HtmlCanvasElement, message: &str) {
        let _ = canvas.set_attribute("data-failed", "true");
        let _ = canvas.set_attribute("data-wisp404-failed", "true");
        web_sys::console::error_1(&JsValue::from_str(&format!("not-found-wisp: {message}")));
        if let Ok(event) = web_sys::Event::new("wisp404failed") {
            let _ = canvas.dispatch_event(&event);
        }
    }

    fn themed_material(elapsed: f32) -> PaletteRampMaterial {
        let mut material = PaletteRampMaterial::engmanager_404().with_time(elapsed);
        THEME_STOPS.with(|stops| {
            material.stops = *stops.borrow();
        });
        material
    }

    fn parse_css_color(input: &str) -> Option<[f32; 4]> {
        parse_css_rgb(input).or_else(|| parse_css_oklch(input))
    }

    fn parse_css_rgb(input: &str) -> Option<[f32; 4]> {
        let input = input.trim();
        let body = input
            .strip_prefix("rgba(")
            .or_else(|| input.strip_prefix("rgb("))?
            .trim_end_matches(')');
        let normalized = body.replace(',', " ").replace('/', " ");
        let mut components = normalized
            .split_whitespace()
            .filter_map(|part| parse_css_component(part));
        let r = components.next()?;
        let g = components.next()?;
        let b = components.next()?;
        Some([
            (r / 255.0).clamp(0.0, 1.0),
            (g / 255.0).clamp(0.0, 1.0),
            (b / 255.0).clamp(0.0, 1.0),
            1.0,
        ])
    }

    fn parse_css_oklch(input: &str) -> Option<[f32; 4]> {
        let body = input.trim().strip_prefix("oklch(")?.trim_end_matches(')');
        let normalized = body.replace(',', " ").replace('/', " ");
        let mut components = normalized.split_whitespace();
        let lightness = parse_oklch_lightness(components.next()?)?;
        let chroma = components.next()?.parse::<f32>().ok()?;
        let hue = components
            .next()?
            .trim_end_matches("deg")
            .parse::<f32>()
            .ok()?;
        Some(oklch_to_srgb(lightness, chroma, hue))
    }

    fn parse_oklch_lightness(part: &str) -> Option<f32> {
        if let Some(percent) = part.strip_suffix('%') {
            percent.parse::<f32>().ok().map(|value| value / 100.0)
        } else {
            part.parse::<f32>().ok()
        }
    }

    fn oklch_to_srgb(lightness: f32, chroma: f32, hue_degrees: f32) -> [f32; 4] {
        let hue = hue_degrees.to_radians();
        let a = chroma * hue.cos();
        let b = chroma * hue.sin();
        let l_prime = lightness + 0.396_337_78 * a + 0.215_803_76 * b;
        let m_prime = lightness - 0.105_561_346 * a - 0.063_854_17 * b;
        let s_prime = lightness - 0.089_484_18 * a - 1.291_485_5 * b;
        let l = l_prime * l_prime * l_prime;
        let m = m_prime * m_prime * m_prime;
        let s = s_prime * s_prime * s_prime;
        let r = 4.076_741_7 * l - 3.307_711_6 * m + 0.230_969_94 * s;
        let g = -1.268_438 * l + 2.609_757_4 * m - 0.341_319_38 * s;
        let b = -0.004_196_086_3 * l - 0.703_418_6 * m + 1.707_614_7 * s;
        [encode_srgb(r), encode_srgb(g), encode_srgb(b), 1.0]
    }

    fn encode_srgb(value: f32) -> f32 {
        let value = value.clamp(0.0, 1.0);
        if value <= 0.003_130_8 {
            value * 12.92
        } else {
            1.055 * value.powf(1.0 / 2.4) - 0.055
        }
    }

    fn parse_css_component(part: &str) -> Option<f32> {
        let part = part.trim();
        if let Some(percent) = part.strip_suffix('%') {
            percent.parse::<f32>().ok().map(|value| value * 2.55)
        } else {
            part.parse::<f32>().ok()
        }
    }
}
