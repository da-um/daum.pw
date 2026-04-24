/**
 * daum.pw - Main Script
 * Modules: Theme, Horizontal Scroll, Signature, Badge, Project Cards, Timeline
 */

/* init calls moved to bottom */

/* ========================================
   Theme Toggle
   ======================================== */

const Theme = {
  key: 'theme',

  init() {
    this.html = document.documentElement;
    this.toggle = document.getElementById('themeToggle');
    if (!this.toggle) return;

    const saved = localStorage.getItem(this.key);
    if (saved) this.html.setAttribute('data-theme', saved);

    this.toggle.addEventListener('click', () => this.switch());
  },

  switch() {
    const current = this.html.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    this.html.setAttribute('data-theme', next);
    localStorage.setItem(this.key, next);
  }
};

/* ========================================
   Horizontal Scroll (GSAP)
   ======================================== */

const HorizontalScroll = {
  init() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
      console.warn('GSAP not loaded');
      return;
    }

    const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 768;
    if (isMobile) return;

    gsap.registerPlugin(ScrollTrigger);

    const section = document.querySelector('.section-projects');
    const track = document.querySelector('.projects-track');
    if (!section || !track) return;

    const distance = () => track.scrollWidth - window.innerWidth;

    gsap.to(track, {
      x: () => -distance(),
      ease: 'power1.inOut',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => '+=' + distance(),
        scrub: 1,
        pin: true,
        invalidateOnRefresh: true
      }
    });

    window.addEventListener('resize', () => ScrollTrigger.refresh());
    window.addEventListener('load', () => ScrollTrigger.refresh());
  }
};

/* ========================================
   Signature Rotator
   ======================================== */

const Signature = {
  key: 'sigIndex',

  init() {
    const el = document.getElementById('heroLine1');
    if (!el || !window.signatures?.length) return;

    const index = parseInt(localStorage.getItem(this.key) || '0', 10);
    const sig = window.signatures[index % window.signatures.length];

    el.innerHTML = sig.line1 + (sig.line2 ? '<br>' + sig.line2 : '');
    localStorage.setItem(this.key, String((index + 1) % window.signatures.length));
  }
};

/* ========================================
   Badge Joke
   ======================================== */

const Badge = {
  jokes: [
    {
      text: '为什么程序员分不清万圣节和圣诞节？因为 Oct 31 == Dec 25。',
      source: '60sapi'
    },
    {
      text: '程序员的两大谎言：1. 我明天就改；2. 这个 Bug 很简单。',
      source: '60sapi'
    },
    {
      text: '程序员的三大美德：懒惰、急躁和傲慢。',
      source: '60sapi'
    },
    {
      text: '先让它跑起来，再让它优雅起来。',
      source: '60sapi'
    }
  ],

  init() {
    const jokeEl = document.getElementById('jokeText');
    const sourceEl = document.getElementById('jokeSource');
    if (!jokeEl) return;
    const current = this.jokes[Math.floor(Math.random() * this.jokes.length)];
    jokeEl.textContent = current.text;
    if (sourceEl) sourceEl.textContent = `冷笑话提供方：${current.source}`;
  }
};

/* ========================================
   Project Cards
   ======================================== */

const ProjectCards = {
  init() {
    document.querySelectorAll('.project-card[data-url]').forEach(card => {
      card.addEventListener('click', () => {
        window.open(card.dataset.url, '_blank');
      });
    });
  }
};

/* ========================================
   Timeline Animation
   ======================================== */

const Timeline = {
  init() {
    const section = document.querySelector('.section-timeline');
    const cards = document.querySelectorAll('.timeline-wheel .timeline-card');
    const dots = document.querySelectorAll('.timeline-dots .dot');
    const total = cards.length;

    if (!section || total === 0) return;

    let current = 0;

    const setActive = (index) => {
      current = index;
      cards.forEach((card, i) => {
        card.classList.remove('active', 'prev', 'next', 'far');
        if (i === index) card.classList.add('active');
        else if (i === index - 1) card.classList.add('prev');
        else if (i === index + 1) card.classList.add('next');
        else card.classList.add('far');
      });
      dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
    };

    setActive(0);
    dots.forEach((dot, i) => dot.addEventListener('click', () => setActive(i)));

    const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 768;
    if (isMobile) return;

    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    window.addEventListener('load', () => ScrollTrigger.refresh());

    ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: () => `+=${window.innerHeight * (total - 1) * 0.8}`,
      pin: true,
      scrub: 0.5,
      onUpdate: (self) => {
        const idx = Math.min(total - 1, Math.floor(self.progress * total));
        if (idx !== current) setActive(idx);
      }
    });
  }
};

/* ========================================
   Mobile Bottom Tab Navigation
   ======================================== */

const MobileNav = {
  init() {
    this.tabBar = document.querySelector('.mobile-tab-bar');
    if (!this.tabBar) return;

    this.tabs = this.tabBar.querySelectorAll('.tab-item');
    this.sections = ['hero', 'projects', 'now', 'timeline', 'links'];
    this.lastScrollY = window.scrollY;
    this.scrollThreshold = 10;
    this.ticking = false;

    this.tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const id = tab.dataset.section;
        const target = document.getElementById(id);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          this.setActive(id);
          this.show();
        }
      });
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.setActive(entry.target.id);
          }
        });
      },
      { rootMargin: '-40% 0px -40% 0px', threshold: 0 }
    );

    this.sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    window.addEventListener('scroll', () => this.onScroll(), { passive: true });
  },

  onScroll() {
    if (this.ticking) return;
    this.ticking = true;
    window.requestAnimationFrame(() => {
      this.updateVisibility();
      this.ticking = false;
    });
  },

  updateVisibility() {
    const currentScrollY = window.scrollY;
    const delta = currentScrollY - this.lastScrollY;

    if (currentScrollY < 50) {
      this.show();
    } else if (delta > this.scrollThreshold) {
      this.hide();
    } else if (delta < -this.scrollThreshold) {
      this.show();
    }

    this.lastScrollY = currentScrollY;
  },

  show() {
    this.tabBar.classList.remove('hidden');
  },

  hide() {
    this.tabBar.classList.add('hidden');
  },

  setActive(sectionId) {
    this.tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.section === sectionId);
    });
  }
};

/* ========================================
   Bootstrap
   ======================================== */

Theme.init();
HorizontalScroll.init();
Signature.init();
Badge.init();
ProjectCards.init();
Timeline.init();
MobileNav.init();
