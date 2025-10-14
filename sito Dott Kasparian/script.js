// Smooth scrolling for navigation links
document.addEventListener('DOMContentLoaded', function() {
    // Smooth scrolling for anchor links
    const navLinks = document.querySelectorAll('a[href^="#"]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Team slider functionality
    const teamCards = document.querySelector('.team-cards');
    const teamViewport = document.querySelector('.team-viewport');
    const sliderDots = document.querySelectorAll('.dot');
    const prevButton = document.querySelector('.slider-prev');
    const nextButton = document.querySelector('.slider-next');
    
    let currentSlide = 0;
    const totalCards = teamCards ? teamCards.children.length : 0;
    let cardsPerView = 3; // fixed to 3 as requested on desktop
    if (window.innerWidth <= 1200 && window.innerWidth > 768) cardsPerView = 2;
    if (window.innerWidth <= 768) cardsPerView = 1;
    
    function updateSlider() {
        if (!teamCards || !teamViewport) return;
        const card = teamCards.children[0];
        const cardWidth = card.getBoundingClientRect().width;
        const gap = parseFloat(getComputedStyle(teamCards).gap) || 0;
        const offset = currentSlide * (cardWidth + gap);
        teamCards.style.transform = `translateX(${-offset}px)`;

        // Update dots to reflect current page (optional, keep first n)
        sliderDots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentSlide);
        });
    }
    
    function nextSlide() {
        const maxSlide = Math.max(0, totalCards - cardsPerView);
        currentSlide = currentSlide >= maxSlide ? 0 : currentSlide + 1;
        updateSlider();
    }
    
    function prevSlide() {
        const maxSlide = Math.max(0, totalCards - cardsPerView);
        currentSlide = currentSlide === 0 ? maxSlide : currentSlide - 1;
        updateSlider();
    }
    
    // Event listeners for slider controls
    if (nextButton) {
        nextButton.addEventListener('click', nextSlide);
    }
    
    if (prevButton) {
        prevButton.addEventListener('click', prevSlide);
    }
    
    // Dot navigation
    sliderDots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            currentSlide = index;
            updateSlider();
        });
    });
    
    // Auto-slide (optional)
    setInterval(nextSlide, 5000);

    // Initialize position on load
    updateSlider();
    
    // Responsive slider update
    window.addEventListener('resize', () => {
        const newCardsPerView = window.innerWidth > 1200 ? 3 : window.innerWidth > 768 ? 2 : 1;
        if (newCardsPerView !== cardsPerView) {
            cardsPerView = newCardsPerView;
            currentSlide = 0;
            updateSlider();
        }
    });

    // Mobile menu toggle (if needed)
    const navContactButton = document.getElementById('nav-contact-button');
    const navContactPopover = document.getElementById('nav-contact-popover');
    const navInfoButton = document.getElementById('nav-info-button');
    const navInfoPopover = document.getElementById('nav-info-popover');
    
    // Contact popover functionality
    if (navContactButton && navContactPopover) {
        navContactButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isShown = navContactPopover.classList.contains('show');
            navContactPopover.classList.toggle('show', !isShown);
            navContactPopover.setAttribute('aria-hidden', isShown ? 'true' : 'false');
            // Close info popover if open
            if (navInfoPopover) {
                navInfoPopover.classList.remove('show');
                navInfoPopover.setAttribute('aria-hidden', 'true');
            }
        });
    }
    
    // Info popover functionality
    if (navInfoButton && navInfoPopover) {
        navInfoButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isShown = navInfoPopover.classList.contains('show');
            navInfoPopover.classList.toggle('show', !isShown);
            navInfoPopover.setAttribute('aria-hidden', isShown ? 'true' : 'false');
            // Close contact popover if open
            if (navContactPopover) {
                navContactPopover.classList.remove('show');
                navContactPopover.setAttribute('aria-hidden', 'true');
            }
        });
    }
    
    // Click outside to close both popovers
    document.addEventListener('click', (e) => {
        if (navContactPopover && !navContactPopover.contains(e.target) && e.target !== navContactButton) {
            navContactPopover.classList.remove('show');
            navContactPopover.setAttribute('aria-hidden', 'true');
        }
        if (navInfoPopover && !navInfoPopover.contains(e.target) && e.target !== navInfoButton) {
            navInfoPopover.classList.remove('show');
            navInfoPopover.setAttribute('aria-hidden', 'true');
        }
    });
    
    // Escape to close both popovers
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (navContactPopover) {
                navContactPopover.classList.remove('show');
                navContactPopover.setAttribute('aria-hidden', 'true');
            }
            if (navInfoPopover) {
                navInfoPopover.classList.remove('show');
                navInfoPopover.setAttribute('aria-hidden', 'true');
            }
        }
    });

    // Form handling (if contact forms are added later)
    const contactForms = document.querySelectorAll('form');
    
    contactForms.forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Basic form validation
            const inputs = form.querySelectorAll('input[required], textarea[required]');
            let isValid = true;
            
            inputs.forEach(input => {
                if (!input.value.trim()) {
                    isValid = false;
                    input.classList.add('error');
                } else {
                    input.classList.remove('error');
                }
            });
            
            if (isValid) {
                // Here you would typically send the form data to a server
                alert('Grazie per il tuo messaggio! Ti contatteremo presto.');
                form.reset();
            } else {
                alert('Per favore, compila tutti i campi obbligatori.');
            }
        });
    });

    // Scroll animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);

    // Observe elements for animation
    const animateElements = document.querySelectorAll('.service-card, .team-card, .contact-item');
    animateElements.forEach(el => {
        observer.observe(el);
    });
});

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Lazy loading for images
const lazyImages = document.querySelectorAll('img[data-src]');
const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.classList.remove('lazy');
            imageObserver.unobserve(img);
        }
    });
});

lazyImages.forEach(img => imageObserver.observe(img));
