// File name: / create_sliders.js
// File description: Generate sliders for the modal

// FOo

// for feature_modal_transitions_
function createSlider1(index) {
    return `
<div class="slider-container">
  <div class="slider-label">
    <span> transition_${index} </span>
    <span class="slider-value" id="transition_${index}-value">100</span> <!-- initial / set value goes here -->
  </div>
  <input type="range" min="0" max="1000000000" value="100" class="slider" id="transition_${index}-slider" data-label="transition_${index}">
</div>`;
}

// for feature_modal_news_
function createSlider2(index) {
    return `
<div class="slider-container">
  <div class="slider-label">
    <span> news_${index} </span>
    <span class="slider-value" id="news_${index}-value">100</span> <!-- initial / set value goes here -->
  </div>
  <input type="range" min="0" max="1000" value="100" class="slider" id="news_${index}-slider" data-label="news_${index}">
</div>`;
}

// for feature_modal_reddit_
function createSlider3(index) {
    return `
<div class="slider-container">
  <div class="slider-label">
    <span> reddit_${index} </span>
    <span class="slider-value" id="reddit_${index}-value">100</span> <!-- initial / set value goes here -->
  </div>
  <input type="range" min="0" max="1000" value="100" class="slider" id="reddit_${index}-slider" data-label="reddit_${index}">
</div>`;
}

function generateSliders(counts) {
    const feature_cats = [
        'feature_modal_transitions_', 
        'feature_modal_news_',
        'feature_modal_reddit_'
    ]
    // Find the modal content section
    const modalSections = [
        document.getElementById('feature_modal_transitions_'),
        document.getElementById('feature_modal_news_'),
        document.getElementById('feature_modal_reddit_')
    ];

    for (let ii = 0; ii < modalSections.length; ii++) {
        const modalSection = modalSections[ii];
            
        
        // if (!modalSection1 || !modalSection2 || !modalSection3) {
        if (!modalSection) {
            console.error('Modal section not found');
            return;
        }
        
        // Find where to insert sliders (after the h2 element)
        const h2Element = modalSection.querySelector('h2');
        const existingSlider = modalSection.querySelector('.slider-container');
        
        if (!h2Element) {
            console.error('H2 element not found in modal');
            return;
        }
        
        // Remove existing slider if it exists (to avoid duplicates)
        if (existingSlider) {
            existingSlider.remove();
        }
        
        // Generate all sliders HTML
        let slidersHTML = '';
        if (ii == 0) { // feature_modal_transitions_
            for (let jj = 0; jj < counts[ii]; jj++) {
                slidersHTML += createSlider1(jj);
                
            }
        }
        else if (ii == 1) { // feature_modal_news_
            for (let jj = 0; jj < counts[ii]; jj++) {
                slidersHTML += createSlider2(jj);
            }
            
        }
        else if (ii == 2) { // feature_modal_reddit_
            for (let jj = 0; jj < counts[ii]; jj++) {
                slidersHTML += createSlider3(jj);
            }
            
        }
        // else skip
        
        // Insert sliders after the h2 element
        h2Element.insertAdjacentHTML('afterend', slidersHTML);
        
        // Add event listeners to all sliders
        addSliderListeners(feature_cats[ii]);
    }
}

function addSliderListeners(feature_cat) {
    const sliders = document.querySelectorAll('#' + feature_cat + '.slider');
    
    sliders.forEach(slider => {
        slider.addEventListener('input', function() {
            const valueSpan = document.getElementById(this.id.replace('-slider', '-value'));
            if (valueSpan) {
                valueSpan.textContent = this.value;
            }
        });
    });
}

// Initialize sliders when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    generateSliders([80, 8, 8]); 
    // Generate 80 sliders (transition_0 to transition_79)
    // then for 8 news_ ; 8 reddit_
});

// Optional - Function to regenerate sliders with different count
function regenerateSliders(count) {
    // Remove all existing sliders
    const existingSliders = document.querySelectorAll('#feature_modal_transitions_ .slider-container');
    // TODO: 'feature_modal_news_' and 'feature_modal_reddit_'
    existingSliders.forEach(slider => slider.remove());
    
    // Generate new ones
    generateSliders(count);
}