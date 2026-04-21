const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const isLowPower = isSafari || isTouchDevice;
function getTemplate(id) {
    const template = document.getElementById(id);
    const clone = document.importNode(template.content, true);
    return clone.firstElementChild;
}
class Particle {
    x;
    y;
    vx;
    vy;
    radius;
    color;
    constructor(width, height, color){
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 2.5;
        this.vy = (Math.random() - 0.5) * 2.5;
        this.radius = Math.random() * (width * 0.6) + width * 0.4;
        this.color = color;
    }
    update(width, height) {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < -this.radius) this.x = width + this.radius;
        if (this.x > width + this.radius) this.x = -this.radius;
        if (this.y < -this.radius) this.y = height + this.radius;
        if (this.y > height + this.radius) this.y = -this.radius;
    }
    draw(ctx) {
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}
class CardAnimator {
    ctx;
    particles = [];
    width;
    height;
    baseColor;
    targetX = -1000;
    targetY = -1000;
    currentX = -1000;
    currentY = -1000;
    constructor(canvas, colors, baseColor){
        this.ctx = canvas.getContext('2d', {
            alpha: false
        });
        this.width = canvas.width = 300;
        this.height = canvas.height = 300;
        this.baseColor = baseColor;
        colors.forEach((c)=>this.particles.push(new Particle(this.width, this.height, c)));
    }
    update() {
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.fillStyle = this.baseColor;
        this.ctx.fillRect(0, 0, this.width, this.height);
        if (isLowPower) {
            if (this.ctx.canvas && !this.ctx.canvas.classList.contains('active')) {
                this.ctx.canvas.classList.add('active');
            }
            return;
        }
        this.particles.forEach((p)=>{
            p.update(this.width, this.height);
            p.draw(this.ctx);
        });
        this.currentX += (this.targetX - this.currentX) * 0.15;
        this.currentY += (this.targetY - this.currentY) * 0.15;
        if (this.currentX > -this.width && this.currentX < this.width * 2 && this.currentY > -this.height && this.currentY < this.height * 2) {
            this.ctx.globalCompositeOperation = 'screen';
            this.ctx.beginPath();
            const radius = this.width * 1.0;
            const grad = this.ctx.createRadialGradient(this.currentX, this.currentY, 0, this.currentX, this.currentY, radius);
            const rgb = this.baseColor.match(/\d+/g);
            if (rgb && rgb.length >= 3) {
                const [r, g, b] = rgb;
                grad.addColorStop(0, `rgba(${Math.min(255, parseInt(r) * 1.8)}, ${Math.min(255, parseInt(g) * 1.8)}, ${Math.min(255, parseInt(b) * 1.8)}, 0.9)`);
                grad.addColorStop(0.4, `rgba(${Math.min(255, parseInt(r) * 1.2)}, ${Math.min(255, parseInt(g) * 1.2)}, ${Math.min(255, parseInt(b) * 1.2)}, 0.5)`);
                grad.addColorStop(1, 'transparent');
            } else {
                grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
                grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.3)');
                grad.addColorStop(1, 'transparent');
            }
            this.ctx.fillStyle = grad;
            this.ctx.arc(this.currentX, this.currentY, radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalCompositeOperation = 'source-over';
        }
        if (this.ctx.canvas && !this.ctx.canvas.classList.contains('active')) {
            this.ctx.canvas.classList.add('active');
        }
    }
}
async function sampleColors(imgUrl, cache) {
    if (cache.has(imgUrl)) return cache.get(imgUrl);
    return new Promise((resolve)=>{
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imgUrl;
        img.onload = ()=>{
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 10;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 64, 10);
            const data = ctx.getImageData(0, 5, 64, 1).data;
            const colorObjects = [];
            let rSum = 0, gSum = 0, bSum = 0;
            for(let i = 0; i < 64; i++){
                const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const saturation = max === 0 ? 0 : (max - min) / max;
                const brightness = max / 255;
                const score = saturation * brightness;
                colorObjects.push({
                    r,
                    g,
                    b,
                    score
                });
                rSum += r;
                gSum += g;
                bSum += b;
            }
            colorObjects.sort((a, b)=>b.score - a.score);
            const uniqueObs = [];
            for (const c of colorObjects){
                let isDistinct = true;
                for (const u of uniqueObs){
                    const dist = Math.abs(c.r - u.r) + Math.abs(c.g - u.g) + Math.abs(c.b - u.b);
                    if (dist < 80) {
                        isDistinct = false;
                        break;
                    }
                }
                if (isDistinct) uniqueObs.push(c);
                if (uniqueObs.length >= 24) break;
            }
            if (uniqueObs.length < 5) {
                for (const c of colorObjects){
                    if (uniqueObs.length >= 24) break;
                    if (!uniqueObs.find((u)=>u.r === c.r && u.g === c.g && u.b === c.b)) {
                        uniqueObs.push(c);
                    }
                }
            }
            const finalColors = uniqueObs.map((c)=>`rgb(${c.r},${c.g},${c.b})`);
            const baseColor = `rgb(${Math.floor(rSum / 64)},${Math.floor(gSum / 64)},${Math.floor(bSum / 64)})`;
            const result = {
                colors: finalColors,
                baseColor
            };
            cache.set(imgUrl, result);
            resolve(result);
        };
        img.onerror = ()=>resolve({
                colors: [],
                baseColor: '#000'
            });
    });
}
function getTitleSize(text, isShare = false) {
    const len = text.length;
    if (isShare) {
        if (len < 15) return '100px';
        if (len < 30) return '80px';
        if (len < 50) return '65px';
        return '55px';
    }
    if (len < 15) return '9cqw';
    if (len < 30) return '7.5cqw';
    if (len < 50) return '6cqw';
    return '5cqw';
}
function resolveTemplate(template, mapping = {}) {
    if (!template) return "";
    const cfg = window.APP_CONFIG || {};
    const author = cfg.author?.name || "";
    const visual_dna_label = cfg.site?.visual_dna_label || "";
    let result = template;
    const context = {
        "author": author,
        "visual_dna_label": visual_dna_label,
        ...mapping
    };
    Object.keys(context).forEach((key)=>{
        result = result.replace(new RegExp(`\\{${key}\\}`, "g"), context[key]);
    });
    if (result.includes("{author}")) {
        result = result.replace(new RegExp(`\\{author\\}`, "g"), author);
    }
    return result;
}
async function generateShareImage(scope, round, item, absoluteRootUrl, colorCache, captureCache, pendingCaptures, getRoundName) {
    const cacheKey = item.id;
    const imgUrl = `${absoluteRootUrl}assets/${scope}/${round}/${item.id}.png`;
    const renderPromise = (async ()=>{
        const cardFragment = getTemplate('tpl-share-card');
        const shareCard = cardFragment.querySelector('.share-card');
        const titleEl = cardFragment.querySelector('.share-title');
        titleEl.textContent = item.title;
        titleEl.style.setProperty('--share-title-size', getTitleSize(item.title, true));
        const cfg = window.APP_CONFIG || {};
        const authorCfg = cfg.author || {};
        cardFragment.querySelector('.share-subtitle').textContent = `${scope.toUpperCase()} – ${getRoundName(scope, round).toUpperCase()}`;
        const watermarkTemplate = authorCfg.watermark_template || "CHỤP BỞI {author}";
        const cleanUrl = window.location.origin + window.location.pathname;
        cardFragment.querySelector('.share-watermark-text').textContent = resolveTemplate(watermarkTemplate);
        cardFragment.querySelector('.share-watermark-url').textContent = cleanUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const brandImg = cardFragment.querySelector('.share-brand-icon');
        try {
            const iconRes = await fetch(`${absoluteRootUrl}favicon.svg`);
            const iconText = await iconRes.text();
            const rasterCanvas = document.createElement('canvas');
            rasterCanvas.width = 256;
            rasterCanvas.height = 128;
            const ctx = rasterCanvas.getContext('2d');
            const imgForRaster = new Image();
            const svgBlob = new Blob([
                iconText
            ], {
                type: 'image/svg+xml;charset=utf-8'
            });
            const url = URL.createObjectURL(svgBlob);
            await new Promise((r, rej)=>{
                imgForRaster.onload = ()=>{
                    ctx.drawImage(imgForRaster, 0, 0, 256, 128);
                    brandImg.src = rasterCanvas.toDataURL('image/png');
                    URL.revokeObjectURL(url);
                    r();
                };
                imgForRaster.onerror = ()=>rej();
                imgForRaster.src = url;
            });
        } catch (e) {
            brandImg.src = `${absoluteRootUrl}favicon.svg`;
        }
        const img = cardFragment.querySelector('.share-palette');
        img.src = imgUrl;
        const data = await sampleColors(imgUrl, colorCache);
        const rx1 = Math.floor(Math.random() * 40) + 60;
        const ry1 = Math.floor(Math.random() * 40) - 20;
        const rx2 = Math.floor(Math.random() * 40) - 20;
        const ry2 = Math.floor(Math.random() * 40) + 70;
        const rx3 = Math.floor(Math.random() * 60) + 20;
        const ry3 = Math.floor(Math.random() * 60) + 20;
        const c1 = data.colors[0] ? data.colors[0].replace('rgb', 'rgba').replace(')', ', 0.95)') : 'rgba(255,255,255,0.1)';
        const c2 = data.colors[1] ? data.colors[1].replace('rgb', 'rgba').replace(')', ', 0.85)') : 'rgba(255,255,255,0.1)';
        const c3 = data.colors[data.colors.length - 1] ? data.colors[data.colors.length - 1].replace('rgb', 'rgba').replace(')', ', 0.8)') : 'rgba(255,255,255,0.1)';
        shareCard.style.backgroundColor = data.baseColor;
        shareCard.style.backgroundImage = `
			radial-gradient(circle at ${rx1}% ${ry1}%, ${c1} 0%, transparent 85%),
			radial-gradient(circle at ${rx2}% ${ry2}%, ${c2} 0%, transparent 80%),
			radial-gradient(circle at ${rx3}% ${ry3}%, ${c3} 0%, transparent 100%)
		`;
        document.body.appendChild(cardFragment);
        await document.fonts.ready;
        const assetsToLoad = [
            img,
            brandImg
        ];
        await Promise.all(assetsToLoad.map((a)=>{
            if (a.complete) return Promise.resolve();
            return new Promise((r)=>{
                a.onload = ()=>r();
                a.onerror = ()=>r();
            });
        }));
        shareCard.offsetHeight;
        await new Promise((r)=>requestAnimationFrame(()=>r()));
        await new Promise((r)=>setTimeout(r, 600));
        try {
            const finalCanvas = await html2canvas(shareCard, {
                scale: 2,
                useCORS: true,
                allowTaint: false,
                backgroundColor: '#000000',
                logging: false
            });
            const fullImageBase64 = finalCanvas.toDataURL('image/png', 1.0);
            captureCache.set(cacheKey, fullImageBase64);
            return {
                img: fullImageBase64,
                colors: data.colors
            };
        } finally{
            shareCard.remove();
            pendingCaptures.delete(cacheKey);
        }
    })();
    pendingCaptures.set(cacheKey, renderPromise);
    return renderPromise;
}
function showShareModal(imgBase64, pageUrl, colors, item) {
    const modalFragment = getTemplate('tpl-share-modal');
    document.body.appendChild(modalFragment);
    const overlay = document.querySelector('.modal-overlay.acrylic');
    const previewContainer = overlay.querySelector('#preview-image-container');
    const urlInput = overlay.querySelector('#share-url-input');
    const copyBtn = overlay.querySelector('#copy-url-btn');
    const downloadBtn = overlay.querySelector('#modal-download-btn');
    const shareBtn = overlay.querySelector('#modal-confirm-share-btn');
    const closeBtn = overlay.querySelector('.close-btn');
    const previewImg = new Image();
    previewImg.src = imgBase64;
    previewImg.className = 'share-preview-img';
    previewContainer.innerHTML = '';
    previewContainer.appendChild(previewImg);
    urlInput.value = pageUrl;
    const mapping = {
        "stage": item.id,
        "stageTitle": item.title
    };
    if (colors.length >= 2) {
        const gradient = `linear-gradient(135deg, ${colors.slice(0, 3).join(', ')})`;
        [
            copyBtn,
            downloadBtn,
            shareBtn
        ].forEach((btn)=>{
            btn.style.background = gradient;
            btn.style.color = '#fff';
            btn.style.border = 'none';
        });
    }
    copyBtn.onclick = ()=>{
        navigator.clipboard.writeText(pageUrl);
        copyBtn.textContent = '✅';
        setTimeout(()=>copyBtn.textContent = '📋', 2000);
    };
    downloadBtn.onclick = ()=>{
        const cfg = window.APP_CONFIG || {};
        const shareCfg = cfg.ui?.share || {};
        const prefixTemplate = shareCfg.download_filename_prefix || "dna-";
        const resolvedPrefix = resolveTemplate(prefixTemplate, mapping);
        const link = document.createElement('a');
        const filename = resolvedPrefix.includes(item.id) ? `${resolvedPrefix}.png` : `${resolvedPrefix}${item.id}.png`;
        link.download = filename;
        link.href = imgBase64;
        link.click();
    };
    shareBtn.onclick = async ()=>{
        const cfg = window.APP_CONFIG || {};
        const shareCfg = cfg.ui?.share || {};
        try {
            const res = await fetch(imgBase64);
            const blob = await res.blob();
            const file = new File([
                blob
            ], `${item.id}.png`, {
                type: 'image/png'
            });
            if (navigator.share) {
                await navigator.share({
                    files: [
                        file
                    ],
                    title: shareCfg.native_share_title || '--Title',
                    text: shareCfg.native_share_text || '--Text',
                    url: pageUrl
                });
            } else {
                alert(shareCfg.error_message || "Trình duyệt không hỗ trợ chia sẻ trực tiếp. Hãy tải ảnh về máy!");
            }
        } catch (e) {
            console.error("Share failed", e);
        }
    };
    const close = ()=>overlay.remove();
    closeBtn.onclick = close;
    overlay.onclick = (e)=>{
        if (e.target === overlay) close();
    };
}
async function captureAndProcess(scope, round, item, absoluteRootUrl, colorCache, captureCache, pendingCaptures, getRoundName) {
    const cacheKey = item.id;
    const imgUrl = `${absoluteRootUrl}assets/${scope}/${round}/${item.id}.png`;
    const cleanUrl = window.location.origin + window.location.pathname;
    if (captureCache.has(cacheKey)) {
        const cachedColors = colorCache.get(imgUrl)?.colors || [];
        showShareModal(captureCache.get(cacheKey), cleanUrl, cachedColors, item);
        return;
    }
    const showLoaderWithPulse = (colors)=>{
        if (document.querySelector('.loading-overlay')) return;
        const loaderFragment = getTemplate('tpl-loading-overlay');
        const loaderDNA = loaderFragment.querySelector('.loader-dna');
        if (loaderDNA && colors && colors.length >= 2) {
            loaderDNA.style.background = `linear-gradient(90deg, ${colors.slice(0, 3).join(', ')})`;
            loaderDNA.style.boxShadow = `0 0 20px ${colors[0]}`;
        }
        document.body.appendChild(loaderFragment);
    };
    let renderResult;
    if (pendingCaptures.has(cacheKey)) {
        showLoaderWithPulse(colorCache.get(imgUrl)?.colors);
        renderResult = await pendingCaptures.get(cacheKey);
    } else {
        showLoaderWithPulse(colorCache.get(imgUrl)?.colors);
        renderResult = await generateShareImage(scope, round, item, absoluteRootUrl, colorCache, captureCache, pendingCaptures, getRoundName);
    }
    document.querySelector('.loading-overlay')?.remove();
    showShareModal(renderResult.img, cleanUrl, renderResult.colors, item);
}
class App {
    db = null;
    currentScope = null;
    currentSongId = null;
    colorCache = new Map();
    captureCache = new Map();
    pendingCaptures = new Map();
    animators = new Set();
    lastScrollPos = new Map();
    absoluteRootUrl;
    currentCards = [];
    constructor(){
        const initialRoot = window.ROOT_DIR || ".";
        let url = new URL(initialRoot, window.location.href).href;
        if (!url.endsWith('/')) url += '/';
        this.absoluteRootUrl = url;
        const favicon = document.querySelector('link[rel="icon"]');
        if (favicon) {
            favicon.href = `${this.absoluteRootUrl}favicon.svg`;
        }
        const baseTag = document.querySelector('base');
        if (baseTag) baseTag.href = this.absoluteRootUrl;
        document.addEventListener('mousemove', this.handleMouseMove);
        this.init();
        this.animate();
    }
    handleMouseMove = (e)=>{
        if (this.currentCards.length === 0) return;
        const rects = this.currentCards.map((c)=>c.getBoundingClientRect());
        const x = e.clientX, y = e.clientY;
        for(let i = 0; i < this.currentCards.length; i++){
            const card = this.currentCards[i];
            const w = rects[i].width;
            const h = rects[i].height;
            const localX = x - rects[i].left;
            const localY = y - rects[i].top;
            card.style.setProperty('--mx', `${localX}px`);
            card.style.setProperty('--my', `${localY}px`);
            const animator = card.animator;
            if (animator) {
                animator.targetX = (localX / w + 0.15) / 1.3 * 300;
                animator.targetY = (localY / h + 0.15) / 1.3 * 300;
            }
        }
    };
    async init() {
        const cfg = window.APP_CONFIG || {};
        try {
            const dataName = cfg.paths?.output_data || "data.json";
            const res = await fetch(`${this.absoluteRootUrl}${dataName}`);
            this.db = await res.json();
            this.parseRoute();
            this.render();
            window.onpopstate = ()=>{
                this.parseRoute();
                this.render();
            };
        } catch (e) {
            console.error(e);
        }
    }
    animate = ()=>{
        if (this.animators.size > 0) {
            this.animators.forEach((a)=>a.update());
        }
        requestAnimationFrame(this.animate);
    };
    parseRoute() {
        const path = window.location.pathname;
        const parts = path.split('/').filter((p)=>p !== "" && p !== "index.html");
        this.currentScope = null;
        this.currentSongId = null;
        if (parts.length > 0) {
            if (this.db && this.db[parts[0]]) {
                this.currentScope = parts[0];
                if (parts.length > 1) this.currentSongId = parts[1];
            } else if (parts.length > 1 && this.db && this.db[parts[1]]) {
                this.currentScope = parts[1];
                if (parts.length > 2) this.currentSongId = parts[2];
            }
        }
    }
    resolveTemplate(template, mapping = {}) {
        if (!template) return "";
        const cfg = window.APP_CONFIG || {};
        const author = cfg.author?.name || "";
        const visual_dna_label = cfg.site?.visual_dna_label || "";
        let result = template;
        const context = {
            "author": author,
            "visual_dna_label": visual_dna_label,
            ...mapping
        };
        Object.keys(context).forEach((key)=>{
            result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), context[key]);
        });
        if (result.includes("{author}")) {
            result = result.replace(new RegExp(`\\{author\\}`, 'g'), author);
        }
        return result;
    }
    getScopeConfig(scope) {
        const cfg = window.APP_CONFIG || {};
        const scopes = cfg.scopes || {};
        const defaultScope = scopes.default || {};
        const currentScope = scopes[scope] || {};
        return {
            ...defaultScope,
            ...currentScope
        };
    }
    getRoundName(scope, round) {
        const sCfg = this.getScopeConfig(scope);
        const roundsCfg = sCfg.rounds || {};
        const rStr = round.toString();
        if (roundsCfg[rStr]) return roundsCfg[rStr];
        const pattern = roundsCfg["default"] || "ROUND {n}";
        return pattern.replace("{n}", rStr);
    }
    getScopeGradient(scope) {
        const sCfg = this.getScopeConfig(scope);
        if (!sCfg.palette || sCfg.palette.length === 0) return null;
        const palette = sCfg.palette;
        const colors = [
            ...palette,
            palette[0]
        ];
        return `linear-gradient(90deg, ${colors.join(', ')})`;
    }
    getGalleryTitle(scope) {
        const sCfg = this.getScopeConfig(scope);
        const prefix = sCfg.gallery_title_prefix || "DNA OF";
        const formattedScope = scope.toUpperCase();
        const gradient = this.getScopeGradient(scope);
        if (gradient) {
            return `<span class="title-sub">${prefix}</span><span class="gradient-text" style="--scope-gradient: ${gradient}">${formattedScope}</span>`;
        }
        return `<span class="title-sub">${prefix}</span><span>${formattedScope}</span>`;
    }
    getCleanTitle(scope) {
        const sCfg = this.getScopeConfig(scope);
        const prefix = sCfg.gallery_title_prefix || "";
        return `${prefix} ${scope.toUpperCase()}`.trim();
    }
    render() {
        const appDiv = document.getElementById('app');
        if (!appDiv || !this.db) return;
        if (this.currentSongId && this.currentScope && !document.querySelector('.detail-page')) {
            this.lastScrollPos.set(this.currentScope, window.scrollY);
        }
        appDiv.innerHTML = '';
        this.animators.clear();
        this.currentCards = [];
        if (this.currentSongId && this.currentScope) {
            this.renderDetail(appDiv, this.currentScope, this.currentSongId);
        } else if (this.currentScope) {
            this.renderGallery(appDiv, this.currentScope);
        } else {
            this.renderHome(appDiv);
        }
        this.currentCards = Array.from(document.querySelectorAll('.card'));
    }
    renderHome(container) {
        const cfg = window.APP_CONFIG || {};
        const homeTitle = this.resolveTemplate(cfg.site?.title || "");
        document.title = homeTitle;
        const view = getTemplate('tpl-home');
        const canvas = view.querySelector('#hero-canvas');
        const heroSection = view.querySelector('.home-hero-vibrant');
        const brandColors = [
            '#e63946',
            '#06d6a0',
            '#118ab2',
            '#ffbe0b'
        ];
        const brandBase = '#0f172a';
        if (isLowPower) {
            heroSection.classList.add('home-hero-static-gradient');
            canvas?.remove();
        } else if (canvas) {
            const animator = new CardAnimator(canvas, brandColors, brandBase);
            this.animators.add(animator);
            heroSection.animator = animator;
        }
        const list = view.querySelector('#scope-list');
        Object.keys(this.db).forEach((scope)=>{
            const scopeData = this.db[scope];
            const roundCount = scopeData.length;
            let totalStages = 0;
            scopeData.forEach((round)=>totalStages += round.length);
            const link = getTemplate('tpl-scope-row');
            link.href = `${this.absoluteRootUrl}${scope}/`;
            link.querySelector('.scope-row-title').textContent = scope.toUpperCase();
            link.querySelector('#meta-rounds').textContent = roundCount.toString();
            link.querySelector('#meta-stages').textContent = totalStages.toString();
            const sCfg = this.getScopeConfig(scope);
            const canvas = link.querySelector('.card-bg');
            const applyColors = (colors, baseColor)=>{
                if (isLowPower) {
                    link.style.backgroundColor = baseColor;
                    canvas?.remove();
                } else if (canvas) {
                    const animator = new CardAnimator(canvas, colors, baseColor);
                    this.animators.add(animator);
                    link.animator = animator;
                }
            };
            if (sCfg.palette && sCfg.palette.length > 0) {
                const colors = sCfg.palette.slice(0, 3);
                const baseColor = sCfg.palette[3] || sCfg.palette[0];
                applyColors(colors, baseColor);
            } else {
                const firstItem = scopeData[0]?.[0];
                if (firstItem) {
                    const imgUrl = `${this.absoluteRootUrl}assets/${scope}/0/${firstItem.id}.png`;
                    sampleColors(imgUrl, this.colorCache).then((data)=>{
                        applyColors(data.colors, data.baseColor);
                    });
                }
            }
            link.onclick = (e)=>{
                e.preventDefault();
                window.history.pushState({}, '', link.href);
                this.parseRoute();
                this.render();
            };
            list.appendChild(link);
        });
        container.appendChild(view);
        this.currentCards = Array.from(document.querySelectorAll('.scope-row'));
    }
    async renderGallery(container, scope) {
        document.title = this.getCleanTitle(scope);
        const view = getTemplate('tpl-gallery');
        view.querySelector('#gallery-title').innerHTML = this.getGalleryTitle(scope);
        const sCfg = this.getScopeConfig(scope);
        const sloganEl = view.querySelector('.hero p');
        if (sloganEl) sloganEl.textContent = sCfg.slogan || "";
        const content = view.querySelector('#gallery-content');
        const scopeData = this.db[scope];
        scopeData.forEach((items, roundIndex)=>{
            if (!items || items.length === 0) return;
            const roundView = getTemplate('tpl-round');
            roundView.querySelector('.round-name').textContent = this.getRoundName(scope, roundIndex);
            const grid = roundView.querySelector('.gallery-grid');
            items.forEach((item)=>{
                const card = getTemplate('tpl-card');
                if (item.id === 'full') card.classList.add('card-full');
                const titleEl = card.querySelector('.card-title');
                titleEl.textContent = item.title;
                titleEl.style.setProperty('--title-size', getTitleSize(item.title));
                card.querySelector('.card-scope-round').textContent = `${scope.toUpperCase()} - ${this.getRoundName(scope, roundIndex).toUpperCase()}`;
                const watermarkEl = card.querySelector('.watermark');
                if (watermarkEl) watermarkEl.textContent = item.title;
                const imgUrl = `${this.absoluteRootUrl}assets/${scope}/${roundIndex}/${item.id}.png`;
                card.querySelector('img').src = imgUrl;
                const href = `${this.absoluteRootUrl}${scope}/${item.id}/`;
                card.href = href;
                const canvas = card.querySelector('.card-bg');
                sampleColors(imgUrl, this.colorCache).then((data)=>{
                    if (isLowPower) {
                        card.style.backgroundColor = data.baseColor;
                        canvas.remove();
                    } else {
                        const animator = new CardAnimator(canvas, data.colors, data.baseColor);
                        this.animators.add(animator);
                        card.animator = animator;
                    }
                });
                card.onclick = (e)=>{
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                    e.preventDefault();
                    const href = card.href;
                    window.history.pushState({}, '', href);
                    this.parseRoute();
                    this.render();
                };
                grid.appendChild(card);
            });
            content.appendChild(roundView);
        });
        container.appendChild(view);
        const savedPos = this.lastScrollPos.get(scope) || 0;
        if (savedPos > 0) {
            requestAnimationFrame(()=>{
                requestAnimationFrame(()=>{
                    setTimeout(()=>{
                        window.scrollTo({
                            top: savedPos,
                            behavior: 'instant'
                        });
                    }, 0);
                });
            });
        }
    }
    renderDetail(container, scope, songId) {
        const cfg = window.APP_CONFIG || {};
        const scopeData = this.db[scope];
        let item = null, roundIndex = -1;
        for(let r = 0; r < scopeData.length; r++){
            const match = scopeData[r].find((i)=>i.id === songId);
            if (match) {
                item = match;
                roundIndex = r;
                break;
            }
        }
        if (!item || roundIndex === -1) {
            this.renderGallery(container, scope);
            return;
        }
        const songTitle = item.title;
        const template = cfg.site?.title_template || "{title}";
        document.title = this.resolveTemplate(template, {
            title: songTitle
        });
        const view = getTemplate('tpl-detail');
        const backBtn = view.querySelector('.back-btn');
        const backHref = `${this.absoluteRootUrl}${scope}/`;
        backBtn.href = backHref;
        backBtn.onclick = (e)=>{
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            window.history.pushState({}, '', backHref);
            this.parseRoute();
            this.render();
        };
        view.querySelector('.detail-title').textContent = songTitle;
        view.querySelector('.detail-round').textContent = `${scope.toUpperCase()} – ${this.getRoundName(scope, roundIndex)}`;
        const imgUrl = `${this.absoluteRootUrl}assets/${scope}/${roundIndex}/${item.id}.png`;
        view.querySelector('#palette-img').src = imgUrl;
        view.querySelector('#yt-link').href = `https://www.youtube.com/watch?v=${item.yt}`;
        const triggerShare = ()=>{
            captureAndProcess(scope, roundIndex, item, this.absoluteRootUrl, this.colorCache, this.captureCache, this.pendingCaptures, this.getRoundName.bind(this));
        };
        const downBtn = view.querySelector('#download-btn');
        const shrBtn = view.querySelector('#share-btn');
        if (downBtn) downBtn.onclick = triggerShare;
        if (shrBtn) shrBtn.onclick = triggerShare;
        container.appendChild(view);
        const paletteWrap = view.querySelector('.detail-palette-wrap');
        const magnifier = view.querySelector('#palette-magnifier');
        const paletteImg = view.querySelector('#palette-img');
        paletteImg.onload = ()=>{
            paletteWrap.onpointermove = (e)=>{
                const moveRect = paletteWrap.getBoundingClientRect();
                const x = Math.max(0, Math.min(e.clientX - moveRect.left, moveRect.width));
                const xPerc = x / moveRect.width * 100;
                magnifier.style.left = `${x}px`;
                magnifier.style.backgroundImage = `url(${imgUrl})`;
                magnifier.style.backgroundSize = `${moveRect.width * 4}px ${moveRect.height * 4}px`;
                magnifier.style.backgroundPosition = `${xPerc}% 50%`;
            };
        };
        const titleEl = view.querySelector('.detail-title');
        sampleColors(imgUrl, this.colorCache).then((data)=>{
            if (data.colors.length >= 2) {
                const gradient = `linear-gradient(90deg, ${data.colors.slice(0, 4).join(', ')})`;
                titleEl.style.background = gradient;
                titleEl.style.backgroundSize = '300% auto';
                titleEl.style.webkitBackgroundClip = 'text';
                titleEl.style.webkitTextFillColor = 'transparent';
                titleEl.style.backgroundClip = 'text';
                const primary = data.colors[0];
                document.documentElement.style.setProperty('--song-accent', primary);
            }
        });
        setTimeout(()=>{
            if (!this.captureCache.has(item.id) && !this.pendingCaptures.has(item.id)) {
                generateShareImage(scope, roundIndex, item, this.absoluteRootUrl, this.colorCache, this.captureCache, this.pendingCaptures, this.getRoundName.bind(this));
            }
        }, 800);
    }
}
new App();
