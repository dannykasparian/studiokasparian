// Smooth scrolling for navigation links
document.addEventListener('DOMContentLoaded', function() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // View routing and smooth scrolling for anchor links
    const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
    const routedLinks = document.querySelectorAll('a[href^="#"]');
    const viewSections = document.querySelectorAll('[data-view]');
    let activeView = 'home';
    let activeTarget = '#home';

    function setActiveNav(targetId) {
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            const isActive = href === targetId || (targetId === '#contact' && href === '#contact');
            link.classList.toggle('active', isActive);
        });
    }

    function switchView(viewName, targetId = '#home', updateHash = true) {
        activeView = viewName;
        activeTarget = targetId;
        document.body.dataset.activeView = viewName;

        viewSections.forEach(section => {
            section.hidden = section.dataset.view !== viewName;
        });

        if (updateHash && window.location.hash !== targetId) {
            history.pushState(null, '', targetId);
        }

        const targetSection = document.querySelector(targetId);
        const scrollTarget = targetSection && !targetSection.hidden ? targetSection : document.querySelector(`[data-view="${viewName}"]`);

        if (scrollTarget) {
            scrollTarget.scrollIntoView({
                behavior: prefersReducedMotion ? 'auto' : 'smooth',
                block: 'start'
            });
        }

        setActiveNav(targetId === '#contact' ? '#contact' : `#${viewName}`);

        if (viewName === 'team') {
            window.requestAnimationFrame(updateSlider);
        }
    }

    routedLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();

            const targetId = this.getAttribute('href');
            if (targetId === '#about') {
                switchView('about', '#about');
                return;
            }

            if (targetId === '#team') {
                switchView('team', '#team');
                return;
            }

            switchView('home', targetId);
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
    
    function getMaxSlide() {
        return Math.max(0, totalCards - cardsPerView);
    }

    function syncSliderDots() {
        if (!teamCards || !sliderDots.length) return;
        const dotsContainer = sliderDots[0].parentElement;
        if (!dotsContainer) return;

        dotsContainer.innerHTML = '';
        for (let index = 0; index <= getMaxSlide(); index++) {
            const dot = document.createElement('button');
            dot.className = `dot${index === currentSlide ? ' active' : ''}`;
            dot.type = 'button';
            dot.setAttribute('aria-label', `Vai al gruppo ${index + 1}`);
            dot.addEventListener('click', () => {
                currentSlide = index;
                updateSlider();
            });
            dotsContainer.appendChild(dot);
        }
    }

    function updateSlider() {
        if (!teamCards || !teamViewport) return;
        const card = teamCards.children[0];
        const cardWidth = card.getBoundingClientRect().width;
        const gap = parseFloat(getComputedStyle(teamCards).gap) || 0;
        currentSlide = Math.min(currentSlide, getMaxSlide());
        const offset = currentSlide * (cardWidth + gap);
        teamCards.style.transform = `translateX(${-offset}px)`;

        document.querySelectorAll('.slider-dots .dot').forEach((dot, index) => {
            dot.classList.toggle('active', index === currentSlide);
        });
    }
    
    function nextSlide() {
        const maxSlide = getMaxSlide();
        currentSlide = currentSlide >= maxSlide ? 0 : currentSlide + 1;
        updateSlider();
    }
    
    function prevSlide() {
        const maxSlide = getMaxSlide();
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
    
    // Initialize position on load
    // NOTE: Auto-slide is DISABLED - carousel only moves on user interaction
    syncSliderDots();
    updateSlider();
    
    // Responsive slider update
    window.addEventListener('resize', () => {
        const newCardsPerView = window.innerWidth > 1200 ? 3 : window.innerWidth > 768 ? 2 : 1;
        if (newCardsPerView !== cardsPerView) {
            cardsPerView = newCardsPerView;
            currentSlide = 0;
            syncSliderDots();
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

    // Polished scroll effects
    const navbar = document.querySelector('.navbar');
    const sections = document.querySelectorAll('section[id]');
    const hero = document.querySelector('.hero');
    const technology = document.querySelector('.technology');

    const onScroll = debounce(() => {
        const scrollY = window.scrollY || window.pageYOffset;
        if (navbar) {
            navbar.classList.toggle('nav-scrolled', scrollY > 24);
        }

        if (!prefersReducedMotion) {
            if (hero) hero.style.setProperty('--hero-shift', `${Math.min(scrollY * 0.08, 44)}px`);
            if (technology) {
                const techTop = technology.getBoundingClientRect().top + scrollY;
                const techShift = Math.max(-36, Math.min(36, (scrollY - techTop) * 0.08));
                technology.style.setProperty('--tech-shift', `${techShift}px`);
            }
        }

        if (activeView !== 'home') {
            setActiveNav(`#${activeView}`);
            return;
        }

        let currentSectionId = activeTarget === '#contact' ? 'contact' : 'home';
        sections.forEach(section => {
            if (section.hidden) return;
            const sectionTop = section.offsetTop - 120;
            if (scrollY >= sectionTop) currentSectionId = section.id;
        });

        navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${currentSectionId}`);
        });
    }, 12);

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('popstate', () => {
        const hash = window.location.hash || '#home';
        if (hash === '#about') {
            switchView('about', '#about', false);
        } else if (hash === '#team') {
            switchView('team', '#team', false);
        } else {
            switchView('home', hash, false);
        }
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

    const revealElements = document.querySelectorAll('.section-header, .about-text, .about-image, .attention-text, .attention-image, .cta-text, .cta-image, .technology-content, .contact-map, .schedule-table');
    revealElements.forEach(el => el.classList.add('reveal'));

    const staggerElements = document.querySelectorAll('.services-grid, .attention-features, .team-cards, .contact-info');
    staggerElements.forEach(el => el.classList.add('reveal-stagger'));

    // Observe elements for animation
    const animateElements = document.querySelectorAll('.reveal, .reveal-stagger, .service-card, .team-card, .contact-item');
    animateElements.forEach(el => {
        observer.observe(el);
    });

    const initialHash = window.location.hash || '#home';
    if (initialHash === '#about') {
        switchView('about', '#about', false);
    } else if (initialHash === '#team') {
        switchView('team', '#team', false);
    } else {
        switchView('home', initialHash, false);
    }
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
