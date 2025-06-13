// File name: simulation.html.js
// File description: script for simulation.html

// Foo

// global vars
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let currentModal = null;


function setupDraggableModals() {
    const modalHeaders = document.querySelectorAll('.modal-header');
    
    modalHeaders.forEach(header => {
        header.addEventListener('mousedown', startDrag);
    });

    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
}

function startDrag(e) {
    isDragging = true;
    currentModal = e.target.closest('.modal-content');
    
    const rect = currentModal.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    
    currentModal.style.transform = 'none';
    document.body.classList.add('dragging');
}

function drag(e) {
    if (!isDragging || !currentModal) return;
    
    e.preventDefault();
    
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    // Keep modal within viewport bounds
    const maxX = window.innerWidth - currentModal.offsetWidth;
    const maxY = window.innerHeight - currentModal.offsetHeight;
    
    const boundedX = Math.max(0, Math.min(newX, maxX));
    const boundedY = Math.max(0, Math.min(newY, maxY));
    
    currentModal.style.left = boundedX + 'px';
    currentModal.style.top = boundedY + 'px';
}

function endDrag() {
    isDragging = false;
    currentModal = null;
    document.body.classList.remove('dragging');
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

class ModalContentSwitcher {
    constructor(modalId) {
        this.modal = document.getElementById(modalId);
        this.currentSection = 'feature_modal_menu';
        this.init();
    }
    
    init() {
        // Event delegation - ONE listener for all buttons
        this.modal.addEventListener('click', (e) => {
            // Check if clicked element has data-target
            if (e.target.hasAttribute('data-target')) {
                const targetId = e.target.getAttribute('data-target');
                this.switchContent(targetId);
            }
        });
        
        // Show default section
        this.switchContent(this.currentSection);
    }
    
    switchContent(targetId) {
        // Hide all sections (now including menu)
        const allSections = this.modal.querySelectorAll('.modal-content-section');
        allSections.forEach(section => {
            section.classList.remove('active');
        });
        
        // Show target section
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.classList.add('active');
            this.currentSection = targetId;
        }
    }
}

// Initialize sliders
function initializeSliders() {
    const sliders = document.querySelectorAll('.slider');
    console.log('Found sliders:', sliders.length);

    sliders.forEach((slider, index) => {
        // console.log(`Attaching events to slider ${index}:`, slider.id);
        const valueDisplay = document.getElementById(slider.id.replace('-slider', '-value'));
        
        // Update display value
        function updateValue() {
            // console.log(valueDisplay);
            let value = slider.value;
            // if (slider.id === 'opacity-slider') {
            //     value += '%';
            // } else if (slider.id === 'scale-slider') {
            //     value += '%';
            // } else if (slider.id === 'duration-slider' || slider.id === 'delay-slider') {
            //     value += 'ms';
            // } else if (slider.id === 'blur-slider') {
            //     value += 'px';
            // }
            valueDisplay.textContent = value;
        }
        
        // Set initial value
        updateValue();
        
        // Update on input
        slider.addEventListener('input', updateValue);
        
        // Send to backend on change
        slider.addEventListener('change', function() {
            // console.log("slider changed!", this.id);
            const label = this.getAttribute('data-label');
            const value = this.value;
            sendSliderData(label, value);
        });
    });

    // console.log("function initializeSliders() test");
}

// Convert linear slider to exponential values
function getExponentialValue(sliderValue) {
    // Maps 0-100 to 1-1000000000
    return Math.pow(10, (sliderValue / 100) * 9);
}

// Event call when slider changed
function sliderChanged (data) {

    const value_para = document.getElementById('value');
    value_para.textContent = "" + data.label + ": " + data.value;
}

// Send slider data to backend
function sendSliderData(label, value) {
    const data = {
        label: label,
        value: value,
        timestamp: Date.now()
    };
    
    console.log('Sending slider data:', data);
    
    // Option 1: Send via fetch (REST API)
    /*
    fetch('/api/transitions/slider', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        console.log('Slider data sent successfully:', result);
    })
    .catch(error => {
        console.error('Error sending slider data:', error);
    });
    */
    
    // Option 2: Send via WebSocket
    /*
    if (window.websocket && window.websocket.readyState === WebSocket.OPEN) {
        window.websocket.send(JSON.stringify({
            type: 'slider_update',
            data: data
        }));
    }
    */
    
    // Option 3: Store in global variable for later use
    window.transitionSettings = window.transitionSettings || {};
    window.transitionSettings[label.toLowerCase()] = value;
    
    // Option 4: Trigger custom event
    // document.dispatchEvent(new CustomEvent('sliderChanged', {
    //     detail: data
    // }));
    sliderChanged(data);
}

// optional, use if needed (for transitional_)
// if large values, turn to logarithmic
// slider.addEventListener('input', function() {
//     if (this.id.startsWith('transitional_')) {
//         const processedValue = Math.round(getExponentialValue(this.value, this.id));
//         valueDisplay.textContent = processedValue;

//     }
// });




// PAGE LOAD event listener
// Interactive functionality
document.addEventListener('DOMContentLoaded', function() {
    // Initialize when page loads
    const modalSwitcher = new ModalContentSwitcher('feature-modal');
    console.log("modalSwitcher initialized!");
    // DAG selection functionality
    const dagSelect = document.getElementById('dagSelect');
    const dagNodes = document.querySelectorAll('.dag-node');
    
    dagSelect.addEventListener('change', function() {
    dagNodes.forEach(node => node.classList.remove('selected'));
    if (this.value) {
        const selectedNode = document.querySelector(`[data-node="${this.value}"]`);
        if (selectedNode) {
        selectedNode.classList.add('selected');
        }
    }
    });
    
    // DAG node click functionality
    dagNodes.forEach(node => {
    node.addEventListener('click', function() {
        dagNodes.forEach(n => n.classList.remove('selected'));
        this.classList.add('selected');
        
        const nodeValue = this.getAttribute('data-node');
        dagSelect.value = nodeValue;
    });
    });
    
    // Get all buttons with data-modal attribute
    const buttons = document.querySelectorAll('[data-modal]');
    const modals = document.querySelectorAll('.modal');
    const closeButtons = document.querySelectorAll('.close-btn');

    // Open modal when button is clicked
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            // console.log("Button is clicked!");
            const modalId = this.getAttribute('data-modal');
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.style.display = 'block';
                // Reset position when opening
                const modalContent = modal.querySelector('.modal-content');
                modalContent.style.top = '50px';
                modalContent.style.left = '50%';
                modalContent.style.transform = 'translateX(-50%)';
            }
        });
    });

    // Close modal when X is clicked
    closeButtons.forEach(closeBtn => {
        closeBtn.addEventListener('mousedown', function(e) {
            e.stopPropagation(); // Prevent drag from starting
        });
        
        closeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            this.closest('.modal').style.display = 'none';
        });
    });

    // Close modal when clicking outside of it
    // window.addEventListener('click', function(event) {
    //     modals.forEach(modal => {
    //         if (event.target === modal) {
    //             modal.style.display = 'none';
    //         }
    //     });
    // });

    // Make modals draggable
    setupDraggableModals();

    // Setup slider value updates
    initializeSliders();
    console.log("sliders initialized!");
    // Listen for custom slider events
    // document.addEventListener('sliderChanged', function(event) {
    //     console.log('Slider changed event received:', event.detail);
        
    //     const value_para = document.getElementById('value');
    //     value_para.textContent = event.detail.value;
    // });


    // Toggle button functionality
    // const toggleAlgo = document.getElementById('toggleAlgo');
    // const toggleRecourse = document.getElementById('toggleRecourse');
    
    // toggleAlgo.addEventListener('click', function() {
    // this.classList.add('active');
    // toggleRecourse.classList.remove('active');
    // });
    
    // toggleRecourse.addEventListener('click', function() {
    // this.classList.add('active');
    // toggleAlgo.classList.remove('active');
    // });
    
    
    
    // Map interaction placeholder
    // const map = document.getElementById('map');
    // map.addEventListener('click', function() {
    // this.textContent = 'Map clicked - Loading data...';
    
    // setTimeout(() => {
    //     this.textContent = 'Map visualization area';
    // }, 1500);
    // });
    
    // Drop selection functionality
    // const dropSelect = document.getElementById('dropSelect');
    // dropSelect.addEventListener('change', function() {
    // if (this.value) {
    //     console.log(`Variable "${this.value}" selected for dropping`);
    // }
    // });
});





// // event listener to switch modal content
// function switchModalContent(targetId) {
    //     // Hide all modal content divs
    //     const allContents = document.querySelectorAll('.modal-body > div');
    //     allContents.forEach(div => div.style.display = 'none');
    
    //     // Show the target div
    //     const targetDiv = document.getElementById(targetId);
    //     if (targetDiv) {
        //         targetDiv.style.display = 'block';
        //     }
        // }

// // set event listener
// document.getElementById('transitions-btn').addEventListener('click', function() {
//     switchModalContent('feature_modal_transitions_');
// });
// EOF