const addButtons = document.querySelectorAll('.add-btn');
const minusButtons = document.querySelectorAll('.minus');
const plusButtons = document.querySelectorAll('.plus');
const qtyDisplays = document.querySelectorAll('.qty input'); 
const floatingCart = document.getElementById('floating-cart');
const cartPanel = document.getElementById('cart-panel');
const closeCart = document.getElementById('close-cart');
const cartList = document.getElementById('cart-list');
const checkoutBtn = document.getElementById('checkout');
const cancelOrderBtn = document.getElementById('cancel-order');
const reorderBtn = document.getElementById('reorder');
const saveOrdersBtn = document.getElementById('save-orders');
const orderSummary = document.getElementById('order-summary');
const phoneInput = document.getElementById('cust-phone');
const customerDetails = document.getElementById('customer-details');
const custDate = document.getElementById('cust-date');
const hourSelect = document.getElementById('hour-select');
const minuteSelect = document.getElementById('minute-select');
const ampmSelect = document.getElementById('ampm-select');
const custTimeHidden = document.getElementById('cust-time');

let cart = [];
let previousOrder = null;

// Enforce PH mobile phone number: exactly 11 digits, must start with "09", formatted as 09XX-XXX-XXXX
phoneInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    if (value.length > 0 && !value.startsWith('0')) {
        value = ''; // Prevent if first digit is not 0
    }
    if (value.length > 1 && !value.startsWith('09')) {
        value = '0'; // Reset to 0 if second digit is not 9
    }
    if (value.length > 11) value = value.slice(0, 11); // Limit to 11 digits
    e.target.value = formatPHMobile(value);
});


function formatPHMobile(value) {
    if (value.length === 11 && value.startsWith('09')) {
        return `${value.slice(0, 4)}-${value.slice(4, 7)}-${value.slice(7)}`;
    }
    return value; // Return unformatted if not complete
}

// Prevent leading zeros and cap at 50 in quantity inputs
qtyDisplays.forEach(input => {
    input.addEventListener('input', () => {
        let value = input.value.replace(/^0+/, '') || '0';
        if (parseInt(value) > 50) value = '50';
        input.value = value;
    });
});

// Cart controls
plusButtons.forEach((btn, i) => btn.addEventListener('click', () => {
    let current = parseInt(qtyDisplays[i].value) || 0;
    if (current < 50) qtyDisplays[i].value = current + 1;
}));
minusButtons.forEach((btn, i) => btn.addEventListener('click', () => {
    let current = parseInt(qtyDisplays[i].value) || 0;
    if (current > 0) qtyDisplays[i].value = current - 1;
}));

// Function to get size key from product name
function getSizeKey(productName) {
    const n = productName.toLowerCase();

    if (n.includes("super") && n.includes("jumbo")) return "superjumbo";
    if (n.includes("superjumbo")) return "superjumbo";
    if (n.includes("jumbo")) return "jumbo";
    if (n.includes("extra large") || n.includes("x-large") || n.includes("xl")) return "xl";
    if (n.includes("large")) return "large";
    if (n.includes("medium")) return "medium";
    if (n.includes("small")) return "small";

    return null; // unknown
}

// Wait for DOM to load before running price-related code
document.addEventListener('DOMContentLoaded', () => {
    // Set pick-up date range: min today, max today + 3 days
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 3);
    custDate.min = today.toISOString().split('T')[0];
    custDate.max = maxDate.toISOString().split('T')[0];

    // Populate hour select based on AM/PM (restricted to 7AM-7PM)
    function populateHours() {
        hourSelect.innerHTML = ''; // Clear existing options
        const ampm = ampmSelect.value;
        let hours = [];
        if (ampm === 'AM') {
            hours = [7, 8, 9, 10, 11]; // 7AM to 11AM
        } else if (ampm === 'PM') {
            hours = [12, 1, 2, 3, 4, 5, 6, 7]; // 12PM to 7PM
        }
        hours.forEach(hour => {
            const option = document.createElement('option');
            option.value = hour;
            option.textContent = hour;
            hourSelect.appendChild(option);
        });
    }

    // Populate minute select (00, 15, 30, 45)
    [0, 15, 30, 45].forEach(min => {
        const option = document.createElement('option');
        option.value = min.toString().padStart(2, '0');
        option.textContent = min.toString().padStart(2, '0');
        minuteSelect.appendChild(option);
    });

    // Populate AM/PM select
    ['AM', 'PM'].forEach(ampm => {
        const option = document.createElement('option');
        option.value = ampm;
        option.textContent = ampm;
        ampmSelect.appendChild(option);
    });

    // Function to update hidden time input in 24-hour format
    function updateHiddenTime() {
        const hour = parseInt(hourSelect.value);
        const minute = minuteSelect.value;
        const ampm = ampmSelect.value;
        if (hour && minute && ampm) {
            let hour24 = hour;
            if (ampm === 'PM' && hour !== 12) hour24 += 12; // 1PM=13, ..., 7PM=19; 12PM=12
            if (ampm === 'AM' && hour === 12) hour24 = 0; // 12AM=00 (though not used here)
            custTimeHidden.value = `${hour24.toString().padStart(2, '0')}:${minute}`;
        } else {
            custTimeHidden.value = '';
        }
    }

    // Event listeners for time picker
    ampmSelect.addEventListener('change', () => {
        populateHours(); // Repopulate hours when AM/PM changes
        updateHiddenTime();
    });
    hourSelect.addEventListener('change', updateHiddenTime);
    minuteSelect.addEventListener('change', updateHiddenTime);

    // Set default time (7:00 AM) on load
    ampmSelect.value = 'AM';
    populateHours(); // Populate hours for AM
    hourSelect.value = '7';
    minuteSelect.value = '00';
    updateHiddenTime(); // Set hidden input

    // Define prices for whole and half trays
    const wholePrices = {
        small: 220,
        medium: 230,
        large: 240,
        xl: 255,
        jumbo: 265,
        superjumbo: 275
    };

    const halfPrices = {
        small: 112,
        medium: 120,
        large: 123,
        xl: 130,
        jumbo: 135,
        superjumbo: 142
    };

    // Function to update prices based on tray type
    function updatePrices(type) {
        document.querySelectorAll('.product-card').forEach(card => {
            const name = card.querySelector('h3').textContent;
            const priceEl = card.querySelector('.price');
            const sizeKey = getSizeKey(name);
            if (sizeKey) {
                if (type === 'half') {
                    priceEl.textContent = `₱${halfPrices[sizeKey]} / half tray`;
                } else {
                    priceEl.textContent = `₱${wholePrices[sizeKey]} / tray`;
                }
            }
        });
    }

    // Event listener for tray type dropdown
    const trayTypeSelect = document.getElementById('tray-type');
    if (trayTypeSelect) {
        trayTypeSelect.addEventListener('change', (e) => {
            updatePrices(e.target.value);
        });
    }

    // Set initial state (whole tray) explicitly
    updatePrices('whole');
    
});

// Updated add to cart logic to include tray type
addButtons.forEach((btn, i) => {
    btn.addEventListener('click', () => {
        let qty = parseInt(qtyDisplays[i].value);
        if(qty===0) return;
        if(qty > 50) qty = 50; // Cap at 50

        const productName = btn.parentElement.querySelector('h3').textContent;
        const price = parseInt(btn.parentElement.querySelector('.price').textContent.replace(/[^\d]/g, '')); // Extract numeric price
        const trayTypeSelect = document.getElementById('tray-type');
        const trayType = trayTypeSelect ? trayTypeSelect.value : 'whole'; // Default to 'whole' if not found

        cart.push({ name: productName, qty, price, trayType });
        qtyDisplays[i].value = "0";

        // Update cart list if panel is open
        if (cartPanel.classList.contains('show')) {
            updateCartList();
        }

        // Create and animate flying alert message (text "Add to Cart")
        const alertMsg = document.createElement('div');
        alertMsg.textContent = "Add to Cart";
        alertMsg.className = 'alert-fly';
        alertMsg.style.fontSize = '16px';
        alertMsg.style.fontWeight = 'bold';
        alertMsg.style.color = 'white';
        alertMsg.style.background = 'var(--accent)';
        alertMsg.style.padding = '8px 12px';
        alertMsg.style.borderRadius = '8px';
        alertMsg.style.position = 'absolute';
        alertMsg.style.zIndex = '1000';
        alertMsg.style.pointerEvents = 'none';
        
        // Position based on row: first row (i=0,1,2) centered, second row (i=3,4,5) from top-left of button
        const btnRect = btn.getBoundingClientRect();
        if (i >= 3) { // Second row
            alertMsg.style.left = btnRect.left + 'px';
            alertMsg.style.top = btnRect.top + 'px';
            // No transform for top-left positioning
        } else { // First row
            const btnCenterX = btnRect.left + btnRect.width / 2;
            const btnCenterY = btnRect.top + btnRect.height / 2;
            alertMsg.style.left = btnCenterX + 'px';
            alertMsg.style.top = btnCenterY + 'px';
            alertMsg.style.transform = 'translate(-50%, -50%)'; // Center the element on the button
        }
        
        // Calculate distance to cart icon center
        const cartRect = floatingCart.getBoundingClientRect();
        const cartCenterX = cartRect.left + cartRect.width / 2;
        const cartCenterY = cartRect.top + cartRect.height / 2;
        const deltaX = cartCenterX - parseFloat(alertMsg.style.left);
        const deltaY = cartCenterY - parseFloat(alertMsg.style.top);
        
        // Set CSS variables for animation
        alertMsg.style.setProperty('--x', deltaX + 'px');
        alertMsg.style.setProperty('--y', deltaY + 'px');
        
        document.body.appendChild(alertMsg);
        
        // Remove after animation
        setTimeout(() => {
            document.body.removeChild(alertMsg);
        }, 1000);

        // Cart bounce animation
        floatingCart.classList.add("cart-animate");
        setTimeout(() => {
            floatingCart.classList.remove("cart-animate");
        }, 500);
    });
});

floatingCart.addEventListener('click', () => {
    cartPanel.classList.add('show');
    updateCartList();
});
closeCart.addEventListener('click', () => cartPanel.classList.remove('show'));

function updateCartList(){
    cartList.innerHTML = '';

    cart.forEach((item, index) => {
        let li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.padding = '10px';
        li.style.border = '1px solid #ccc';
        li.style.borderRadius = '8px';
        li.style.marginBottom = '10px';
        li.style.background = '#f9f9f9';

        // Left container (no image since images were removed)
        const leftPart = document.createElement('div');
        leftPart.style.display = 'flex';
        leftPart.style.alignItems = 'center';
        leftPart.style.flexGrow = '1';

        // Text container
        const textContainer = document.createElement('div');
        textContainer.style.flexGrow = '1';

        // Updated product name with tray type indication (split for styling)
        const trayTypeDisplay = item.trayType === 'half' ? 'Half Tray' : 'Whole Tray';
        const productName = document.createElement('p');
        productName.textContent = item.name;
        productName.style.fontWeight = 'bold';
        productName.style.margin = '0 0 2px 0'; // Adjusted margin for spacing
        productName.style.fontSize = '16px';

        const trayType = document.createElement('span');
        trayType.textContent = ` (${trayTypeDisplay})`;
        trayType.style.fontSize = '14px'; // Smaller font
        trayType.style.fontWeight = 'normal'; // Not bold

        productName.appendChild(trayType); // Append tray type to product name
        textContainer.appendChild(productName);

        // Quantity controls
        const qtyControls = document.createElement('div');
        qtyControls.style.display = 'flex';
        qtyControls.style.alignItems = 'center';
        qtyControls.style.gap = '7px';

        const minusBtn = document.createElement('button');
        minusBtn.textContent = '−';
        minusBtn.style.width = '30px';
        minusBtn.style.height = '30px';
        minusBtn.style.borderRadius = '5px';
        minusBtn.style.border = '1px solid #999';
        minusBtn.style.cursor = 'pointer';
        minusBtn.onclick = () => {
            if(item.qty > 1){
                item.qty--;
            } else {
                cart.splice(index, 1);
            }
            updateCartList();
        };

        const qtyText = document.createElement('span');
        qtyText.textContent = item.qty;
        qtyText.style.minWidth = '20px';
        qtyText.style.textAlign = 'center';

        const plusBtn = document.createElement('button');
        plusBtn.textContent = '+';
        plusBtn.style.width = '30px';
        plusBtn.style.height = '30px';
        plusBtn.style.borderRadius = '5px';
        plusBtn.style.border = '1px solid #999';
        plusBtn.style.cursor = 'pointer';
        plusBtn.onclick = () => {
            if (item.qty < 50) {
                item.qty++;
                updateCartList();
            }
        };

        qtyControls.appendChild(minusBtn);
        qtyControls.appendChild(qtyText);
        qtyControls.appendChild(plusBtn);

        textContainer.appendChild(qtyControls);
        leftPart.appendChild(textContainer); // No image appended

        // Price display
        const price = document.createElement('div');
        price.textContent = `₱${(item.qty * item.price).toFixed(2)}`;
        price.style.fontWeight = 'bold';
        price.style.minWidth = '60px';
        price.style.textAlign = 'right';
        price.style.marginLeft = '12px';

        // Remove button with confirmation popup 
        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '🗑️';
        removeBtn.style.background = 'none';
        removeBtn.style.border = 'none';
        removeBtn.style.cursor = 'pointer';
        removeBtn.style.fontSize = '18px';
        removeBtn.style.marginLeft = '5px';
        removeBtn.title = 'Remove item';
        removeBtn.onclick = () => {
            showConfirmModal("Delete the item?", () => {
                cart.splice(index, 1);
                updateCartList();
            }, () => {
                // Do nothing on cancel (user can think again)
            }, "OK", "Cancel");
        };

        li.appendChild(leftPart);
        li.appendChild(price);
        li.appendChild(removeBtn);

        cartList.appendChild(li);
    });
}

// Render summary
function renderOrderSummary(order){
    orderSummary.innerHTML="";
    customerDetails.innerHTML="";
    let total=0;
    order.cart.forEach(item=>{
        // Ensure trayType exists for backward compatibility
        const trayTypeDisplay = item.trayType === 'half' ? 'Half Tray' : 'Whole Tray';
        total += item.qty*item.price;
        orderSummary.innerHTML += `<p><strong>${item.name}</strong> <span style="font-size: smaller; font-weight: normal;">(${trayTypeDisplay})</span>: ${item.qty} tray(s) — ₱${item.qty*item.price}</p>`;
    });
    orderSummary.innerHTML += `<hr><p><strong>Total: ₱${total}</strong></p>`;
    customerDetails.innerHTML = `
        <p><strong>Name:</strong> ${order.name}</p>
        <p><strong>Phone:</strong> ${order.phone}</p>
        <p><strong>Address:</strong> ${order.address}</p>
        <p><strong>Date:</strong> ${order.date}</p>
        <p><strong>Notes:</strong> ${order.notes||"None"}</p>
    `;
}

// Place Order
checkoutBtn.addEventListener('click', () => {
    let name = document.getElementById('cust-name').value;
    let phone = document.getElementById('cust-phone').value;
    let address = document.getElementById('cust-address').value;
    let date = document.getElementById('cust-date').value;
    let notes = document.getElementById('cust-notes').value;

    if(!name || !phone || !address){
        showConfirmModal("Please fill out required fields!", () => {});
        return;
    }
    if(cart.length === 0){
        showConfirmModal("Your cart is empty!", () => {});
        return;
    }

    // Generate unique order ID (timestamp)
    const orderID = Date.now();
    // Create new order object
    const newOrder = {
        id: orderID,
        cart: JSON.parse(JSON.stringify(cart)), // deep copy of current cart
        name,
        phone,
        address,
        date,
        notes,
        status: "pending"
    };

    // Load existing orders from localStorage
    let orders = JSON.parse(localStorage.getItem('orders')) || [];
    orders.push(newOrder); // Add new order
    
    // Save updated orders array to localStorage
    localStorage.setItem('orders', JSON.stringify(orders));

    // Show success message modal with OK button
    showConfirmModal("Order placed successfully!", () => {
        previousOrder = {cart: JSON.parse(JSON.stringify(cart)), name, phone, address, date, notes};
        renderOrderSummary(previousOrder);

        // Clear cart and form
        cart = [];
        updateCartList();
        document.getElementById('cust-name').value="";
        document.getElementById('cust-phone').value="";
        document.getElementById('cust-address').value="";
        document.getElementById('cust-date').value="";
        document.getElementById('cust-notes').value="";

        // Ask if user wants to go to profile
        showConfirmModal(
            "Do you want to be redirected to your profile?",
            () => { window.location.href = "profile.html"; }, // Yes
            () => {}, // No
            "Yes",
            "No"
        );
    });
});

// Cancel order
cancelOrderBtn.addEventListener('click', () => {
    showConfirmModal(
        "Are you sure you want to cancel the order?",
        () => {
            // On Yes
            cart = [];
            updateCartList();
            orderSummary.innerHTML = "";
            customerDetails.innerHTML = "";
            showConfirmModal("Order cancelled!", () => {});
        },
        () => {
            // On No, do nothing
        },
        "Yes",
        "No"
    );
});

// Reorder previous purchase
reorderBtn.addEventListener('click', () => {
    if(previousOrder){
        cart = JSON.parse(JSON.stringify(previousOrder.cart));
        // Ensure trayType exists for backward compatibility
        cart.forEach(item => {
            if (!item.trayType) item.trayType = 'whole'; // Default if missing
        });
        document.getElementById('cust-name').value = previousOrder.name;
        document.getElementById('cust-phone').value = previousOrder.phone;
        document.getElementById('cust-address').value = previousOrder.address;
        document.getElementById('cust-date').value = previousOrder.date;
        document.getElementById('cust-notes').value = previousOrder.notes;
        updateCartList();
        showConfirmModal("Previous order loaded!", () => {});
    } else {
        showConfirmModal("No previous order found.", () => {});
    }
});

// Save orders to local storage
saveOrdersBtn.addEventListener('click', () => {
    if(previousOrder) localStorage.setItem('lastOrder', JSON.stringify(previousOrder));
    showConfirmModal("Order saved to local storage!", () => {});
});

// Render summary
function renderOrderSummary(order){
    orderSummary.innerHTML="";
    customerDetails.innerHTML="";
    let total=0;
    order.cart.forEach(item=>{
        // Ensure trayType exists for backward compatibility
        const trayTypeDisplay = item.trayType === 'half' ? 'Half Tray' : 'Whole Tray';
        total += item.qty*item.price;
        orderSummary.innerHTML += `<p><strong>${item.name} (${trayTypeDisplay})</strong>: ${item.qty} tray(s) — ₱${item.qty*item.price}</p>`;
    });
    orderSummary.innerHTML += `<hr><p><strong>Total: ₱${total}</strong></p>`;
    customerDetails.innerHTML = `
        <p><strong>Name:</strong> ${order.name}</p>
        <p><strong>Phone:</strong> ${order.phone}</p>
        <p><strong>Address:</strong> ${order.address}</p>
        <p><strong>Date:</strong> ${order.date}</p>
        <p><strong>Notes:</strong> ${order.notes||"None"}</p>
    `;
}


// Email confirmation (opens mail client)
//function sendEmail(order){
//    const subject = encodeURIComponent("Margie & RJ Egg Store Order Confirmation");
//    const body = encodeURIComponent(`Hello ${order.name},\n\nThank you for your order! Here is your summary:\n${order.cart.map(i=>`${i.name} x${i.qty}`).join('\n')}\nTotal: ₱${order.cart.reduce((a,b)=>a+b.qty*b.price,0)}\n\nWe will deliver to: ${order.address}\n\nDate: ${order.date}\nNotes: ${order.notes||"None"}`);
//    window.open(`mailto:${order.name}@example.com?subject=${subject}&body=${body}`);
//}


/**
 * Shows a modal confirmation or alert dialog.
 * @param {string} message - Message text to display.
 * @param {function} onConfirm - Function to call when user confirms (clicks "Ok" or "Yes").
 * @param {function} [onCancel] - Optional function when user cancels (clicks "Cancel" or "No").
 * @param {string} [confirmText='Ok'] - Label for confirm button.
 * @param {string} [cancelText] - Label for cancel button; if omitted shows single confirm button.
 */
function showConfirmModal(message, onConfirm, onCancel, confirmText = 'Ok', cancelText) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'confirm-modal-overlay';

    // Modal box
    const box = document.createElement('div');
    box.className = 'confirm-modal-box';

    // Message element
    const msg = document.createElement('p');
    msg.textContent = message;

    // Buttons container
    const btnContainer = document.createElement('div');
    btnContainer.className = 'confirm-modal-buttons';

    // Confirm button
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'confirm-ok-btn';
    confirmBtn.textContent = confirmText;
    confirmBtn.onclick = () => {
        document.body.removeChild(overlay);
        onConfirm();
    };

    btnContainer.appendChild(confirmBtn);

    if (cancelText) {
        // Cancel button if label provided
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'confirm-cancel-btn';
        cancelBtn.textContent = cancelText;
        cancelBtn.onclick = () => {
            document.body.removeChild(overlay);
            if (onCancel) onCancel();
        };
        btnContainer.insertBefore(cancelBtn, confirmBtn); // Cancel on left
    }

    box.appendChild(msg);
    box.appendChild(btnContainer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

//FOR SIDE NAV BAR
const sideNav = document.getElementById('side-nav');
const toggleBtn = document.getElementById('toggle-btn');

toggleBtn.addEventListener('click', () => {
    sideNav.classList.toggle('expanded');
});

//FOR LOGOUT MODAL POP-UP

const logoutBtn = document.getElementById('logout-btn');
const logoutModal = document.getElementById('logout-modal');
const cancelLogout = document.getElementById('cancel-logout');
const confirmLogout = document.getElementById('confirm-logout');

logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    logoutModal.style.display = 'flex';
});

cancelLogout.addEventListener('click', () => {
    logoutModal.style.display = 'none';
});

confirmLogout.addEventListener('click', () => {
    logoutModal.style.display = 'none';
    alert('Logged out!'); // Replace with actual logout logic
});

// AUTO EXPIRATION SYSTEM ---------------------------------

const expirationDays = {
    small: 14,
    medium: 14,
    large: 14,
    xl: 14,
    jumbo: 14,
    superjumbo: 14
};

function updateExpirations() {
    const expiryElements = document.querySelectorAll('.expiry');

    expiryElements.forEach(el => {
        const type = el.dataset.size;
        const days = expirationDays[type];

        const today = new Date();
        const expiryDate = new Date();
        expiryDate.setDate(today.getDate() + days);

        const left = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

        el.textContent = `By ${left} day(s), this egg will expire. Consume wisely.`;
    });
}

updateExpirations();

// refresh every 24 hours (automatic)
setInterval(updateExpirations, 86400000);
