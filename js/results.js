let scores = {};
let svgCache = new Map();

// --- Helper function: Convert Emoji character to SVG filename ---
function getEmojiFilename(emojiChar) {
    const codePoints = [];
    for (const char of emojiChar) {
        const codePoint = char.codePointAt(0);
        // Ensure valid code point and exclude Variation Selector-16
        if (codePoint && codePoint !== 0xFE0F) {
            codePoints.push(codePoint.toString(16));
        }
    }
    const filenameBase = codePoints.join('_');
    return `emoji_u${filenameBase}.svg`;
}

// --- SVG Preload Function ---
async function preloadAndCacheSVGs() {
    const emojiImages = $('.endpoint-emoji img[data-emoji-filename]');
    const uniqueFilenames = new Set();
    emojiImages.each(function() {
        const filename = $(this).data('emoji-filename');
        if (filename) {
            uniqueFilenames.add(filename);
        }
    });

    try {
        await Promise.all(Array.from(uniqueFilenames).map(async (filename) => {
            if (!svgCache.has(filename)) {
                try {
                    const response = await fetch(`img/emoji/${filename}`);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status} for ${filename}`);
                    }
                    const svgText = await response.text();
                    const cleanedSvgText = svgText
                        .replace(/<\?xml.*?\?>/g, '')
                        .replace(/<!--.*?-->/g, '');
                    svgCache.set(filename, cleanedSvgText);
                } catch (fetchError) {
                     console.error(`Failed to fetch or process SVG: img/emoji/${filename}`, fetchError);
                     svgCache.set(filename, null); // Indicate fetch failure
                }
            }
        }));
    } catch (error) {
        console.error('Error preloading SVGs:', error);
        alert('加载 Emoji 图片资源失败，截图功能可能无法正常工作。\n错误: ' + error.message);
    }
}

// --- Generate HTML for a single axis ---
function createAxisHTML(axis, score) {
    const position = ((score + 10) / 20 * 100).toFixed(1);
    const leftEmojiFilename = getEmojiFilename(axis.leftEmoji);
    const rightEmojiFilename = getEmojiFilename(axis.rightEmoji);

    return `
        <div class="axis">
            <div class="axis-label on-surface-variant-text">${axis.name}</div>
            <div class="axis-scale">
                <div class="endpoint">
                    <span class="endpoint-emoji">
                        <img src="img/emoji/${leftEmojiFilename}" alt="${axis.leftEmoji}" data-emoji-char="${axis.leftEmoji}" data-emoji-filename="${leftEmojiFilename}">
                    </span>
                    <span class="endpoint-label on-surface-variant-text">${axis.left}</span>
                </div>
                <div class="scale">
                    <div class="scale-line"></div>
                    <div class="arrow left"></div>
                    <div class="center-mark"></div>
                    <div class="arrow right"></div>
                    <div class="marker" style="left: ${position}%">
                        <span class="score-value surface on-surface-text z-depth-1">${score.toFixed(1)}</span>
                    </div>
                </div>
                <div class="endpoint">
                    <span class="endpoint-emoji">
                        <img src="img/emoji/${rightEmojiFilename}" alt="${axis.rightEmoji}" data-emoji-char="${axis.rightEmoji}" data-emoji-filename="${rightEmojiFilename}">
                    </span>
                    <span class="endpoint-label on-surface-variant-text">${axis.right}</span>
                </div>
            </div>
        </div>
    `.trim();
}

// --- Initialize page content ---
function initialize() {
    scores = {};
    axes.forEach(axis => {
        scores[axis.id] = get_value(axis.id);
    });

    const $container = $('.card-content');
    if (!$container.length) {
        console.error("Error: '.card-content' not found!");
        return;
    }
    $container.empty();

    axes.forEach(axis => {
        const score = scores[axis.id] || 0;
        $container.append(createAxisHTML(axis, score));
    });
}

// --- Get score value from URL hash ---
function get_value(key) {
    try {
        const url = new URL(window.location.href);
        const params = new URLSearchParams(url.hash.substring(1));
        const value = params.get(key);
        return value !== null ? parseFloat(value) : 0;
    } catch (e) {
        console.error("Error parsing URL hash:", e);
        return 0;
    }
}


// --- Document Ready Handler ---
$(document).ready(async () => {

    // Load navbar
    $("#navbar-container").load("navbar.html");
    
    initialize();

    try {
        M.FloatingActionButton.init($('.fixed-action-btn'));
        var tooltips = document.querySelectorAll('.tooltipped');
        M.Tooltip.init(tooltips, {});
        new M.Toast({text: '点击右下角分享按钮可保存测试结果', displayLength: 3000});
    } catch (e) {
        console.error("Error initializing Materialize components:", e);
    }

    try {
        await preloadAndCacheSVGs();
    } catch (error) {
        console.error("SVG preloading failed, screenshot might not work correctly.");
    }


    // --- Share Button Click Handler ---
    $('#share').click(async () => {
        const sectionElement = document.querySelector('main .section'); // Find the section in the original document
        if (!sectionElement) {
             alert('页面结构异常 (section not found)，无法生成截图。');
             return;
        }
        const $section = $(sectionElement); // Optional jQuery wrapper if needed later

        try {
            const canvas = await html2canvas(sectionElement, { // *** Target sectionElement ***
                backgroundColor: '#fcfcff', // Force light background for the canvas itself
                scale: window.devicePixelRatio || 2,
                useCORS: true,
                width: 800,
                // --- onclone now operates on the cloned section element ---
                onclone: (clonedDoc, clonedSectionElement) => {
                    clonedDoc.documentElement.style.fontSize = '16px';

                    const $clonedSection = $(clonedSectionElement);

                    $clonedSection.css({
                        'padding-top': '16px',
                        'padding-bottom': '16px',
                        'background-color': '#fcfcff',
                        'color': '#1a1c1e',
                        'box-sizing': 'border-box',
                        'width': '800px',
                        'margin': '0 auto'
                    });
                    const clonedBody = clonedDoc.body;
                    clonedBody.style.margin = '0';
                    clonedBody.style.padding = '0';
                    clonedBody.style.backgroundColor = '#fcfcff';

                    $(clonedDoc).find('.fixed-action-btn').css('display', 'none');

                    const $title = $clonedSection.find('h2.center-align.primary-text');
                    const $subtitle = $clonedSection.find('h5.center-align.on-surface-variant-text');
                    const $clonedCard = $clonedSection.find('.card');

                    if ($title.length) {
                        $title.css({
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
                            fontSize: '56.96px',
                            fontWeight: '400',
                            lineHeight: '62.656px',
                            color: '#006495',
                            marginTop: '14px',
                            marginBottom: '0',
                            textAlign: 'center'
                        });
                    } else { console.warn('Title not found in cloned section.'); }

                    if ($subtitle.length) {
                         $subtitle.css({
                             fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
                             fontSize: '26.24px',
                             fontWeight: '400',
                             lineHeight: '28.864px',
                             color: '#41474d',
                             marginTop: '14px',
                             marginBottom: '14px',
                             textAlign: 'center'
                         });
                    } else { console.warn('Subtitle not found in cloned section.'); }

                    if ($clonedCard.length) {
                        $clonedCard.removeClass('col s12 m10 offset-m1 l8 offset-l2')
                            .css({
                                width: '800px',
                                marginTop: '0',
                                marginBottom: '0',
                                marginLeft: 'auto',
                                marginRight: 'auto',
                                boxSizing: 'border-box',
                                backgroundColor: '#fcfcff',
                                boxShadow: 'none'
                            });

                        $clonedCard.find('.card-content').css('background-color', '#fcfcff');

                    $clonedCard.find('.card-content')
                        .css('padding', '24px')
                        .css({
                            'width': '100%',
                            'box-sizing': 'border-box'
                        });

                    const $axes = $clonedCard.find('.axis');
                    $axes.each(function(index, element) {
                        const $axis = $(element);
                        const isLastAxis = index === $axes.length - 1;
                        $axis.css('background-color', '#dee3ea');
                        $axis.find('.axis-label').css('color', '#41474d');
                        $axis.find('.endpoint-label').css('color', '#41474d');
                        $axis.find('.scale-line').css('background-color', '#1a1c1e');
                        $axis.find('.center-mark').css('background-color', '#1a1c1e');
                        $axis.find('.arrow.left').css('border-right-color', '#1a1c1e');
                        $axis.find('.arrow.right').css('border-left-color', '#1a1c1e');
                        $axis.find('.endpoint').css('border-color', '#72787e');
                        const $scoreValue = $axis.find('.score-value');
                        $scoreValue.css('color', '#1a1c1e');
                        $axis.find('.marker').css('background-color', '#ba1a1a');

                        $axis.css({
                            'margin-top': '0',
                            'margin-bottom': isLastAxis ? '0' : '16px',
                            'padding-top': '16px',
                            'padding-bottom': '16px',
                            'padding-left': '16px',
                            'padding-right': '16px'
                        });
                        $axis.find('.axis-label').css({
                            'font-size': '20px',
                            'margin-bottom': '10px',
                            'line-height': (20 * 1.4).toFixed(1) + 'px'
                        });
                        $axis.find('.axis-scale').css({
                            'gap': '20px'
                        });
                        $axis.find('.scale').css({
                            'height': '80px'
                        });
                        $axis.find('.endpoint').css({
                            'width': '80px',
                            'height': '80px',
                            'padding': '4px'
                        });
                        $axis.find('.endpoint-label').css({
                            'font-size': '16px',
                            'line-height': (16 * 1.4).toFixed(1) + 'px'
                        });
                        $axis.find('.scale-line').css({
                            'height': '2px'
                        });
                        $axis.find('.center-mark').css({
                            'width': '2px',
                            'height': '12px'
                        });
                        $axis.find('.arrow.left').css({
                            'left': '-10px',
                            'border-top-width': '6px',
                            'border-bottom-width': '6px',
                            'border-right-width': '10px'
                        });
                        $axis.find('.arrow.right').css({
                            'right': '-10px',
                            'border-top-width': '6px',
                            'border-bottom-width': '6px',
                            'border-left-width': '10px'
                        });
                        $axis.find('.marker').css({
                            'width': '12px',
                            'height': '12px'
                        });
                        $scoreValue.css({
                            'font-size': '16px', 
                            'top': '-27.6px', 
                            'padding': '2px', 
                            'border-radius': '3px', 
                            'left': '50%', 
                            'transform': 'translateX(-50%)', 
                            'line-height': 'normal',
                            'white-space': 'nowrap', 
                            'background-color': '#fcfcff',
                            'box-shadow': 'none'
                        });

                        const $clonedEmojiSpans = $axis.find('.endpoint-emoji');
                         $clonedEmojiSpans.each(function() {
                             const $span = $(this);
                             const $imgElement = $span.find('img[data-emoji-filename]');
                             if (!$imgElement.length) return;
                             const filename = $imgElement.data('emoji-filename');
                             const emojiChar = $imgElement.data('emoji-char');
                             if (svgCache.has(filename)) {
                                 const svgContent = svgCache.get(filename);
                                 if (svgContent === null) {
                                     $span.html(emojiChar || '?');
                                 } else {
                                     try {
                                         const parser = new DOMParser();
                                         const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
                                         const svgElement = svgDoc.documentElement;
                                         if (svgElement && svgElement.tagName.toLowerCase() === 'svg' && !svgElement.querySelector('parsererror')) {
                                             const $svgElement = $(svgElement);
                                             $svgElement.removeAttr('id');
                                             $svgElement.removeAttr('xml:space');
                                             $svgElement.css({
                                                 'width': '56px', 'height': '56px', 'display': 'block', 'margin': '0 auto'
                                             });
                                             $imgElement.replaceWith($svgElement);
                                         } else { $span.html(emojiChar || '?'); }
                                     } catch (parseError) { $span.html(emojiChar || '?'); }
                                 }
                             } else { $span.html(emojiChar || '?'); }
                         });
                    });
                } else { console.warn('Card not found in cloned section.'); }

                const scrollHeight = clonedSectionElement.scrollHeight;
                clonedSectionElement.style.height = `${scrollHeight}px`;
            }
            });

            const link = document.createElement('a');
            link.download = 'IMessiValuesResult.png';
            link.href = canvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error('html2canvas or download failed:', error);
            alert('生成或保存图片失败，请检查浏览器控制台获取详细错误信息。\n错误: ' + (error.message || error));
        }
    });

    // --- Retake MeiTest Button Handler ---
    $('#refresh').click(() => {
        localStorage.removeItem('iMeiTestState_v2');
        console.log("Cleared iMeiTest state for retake.");
        window.location.href = 'iMeiTest.html';
    });
});
