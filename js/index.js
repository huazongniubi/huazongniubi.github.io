$(function() {
    // Load navbar
    $("#navbar-container").load("navbar.html"); 

    // Initialize Collapsibles
    const collapsibles = document.querySelectorAll('.collapsible');
    collapsibles.forEach(elem => {
        if (elem.classList.contains('expandable')) {
            // Initialize expandable collapsible
            M.Collapsible.init(elem, { accordion: false });
        } else {
            // Initialize default (accordion) collapsible
            M.Collapsible.init(elem, {});
        }
    });
});
