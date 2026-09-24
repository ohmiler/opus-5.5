import gsap from 'gsap'

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/**
 * Project dossier. Opens while the camera is still landing, so reading
 * starts the moment the planet settles into frame.
 */
export class ProjectPanel {
  constructor({ root, onClose, onStep }) {
    this.root = root
    this.body = root.querySelector('[data-panel-body]')
    this.isOpen = false
    this.project = null
    this.timeline = null

    this.onClick = (e) => {
      if (e.target.closest('[data-close]')) onClose()
      const step = e.target.closest('[data-step]')
      if (step) onStep(Number(step.dataset.step))
    }
    root.addEventListener('click', this.onClick)
  }

  render(project, index, total) {
    const prev = (index - 1 + total) % total
    const next = (index + 1) % total
    this.root.style.setProperty('--accent', project.world.accent)
    this.body.innerHTML = `
      <div class="panel__head">
        <p class="panel__code mono" data-reveal>${esc(project.code)} <span>·</span> ${esc(project.classification)}</p>
        <h2 class="panel__title serif" id="panel-title">
          ${[...project.name].map((c) => `<span class="panel__char"><span>${esc(c)}</span></span>`).join('')}
        </h2>
        <p class="panel__tagline serif" data-reveal>${esc(project.tagline)}</p>
      </div>

      <span class="panel__rule" data-rule></span>

      <dl class="panel__data">
        ${[
          ['Client', project.client],
          ['Year', project.year],
          ['Role', project.role],
          ['Duration', project.duration],
        ]
          .map(([k, v]) => `<div data-reveal><dt class="mono">${k}</dt><dd>${esc(v)}</dd></div>`)
          .join('')}
      </dl>

      <p class="panel__desc" data-reveal>${esc(project.description)}</p>

      <ol class="panel__highlights">
        ${project.highlights.map((h, i) => `<li data-reveal><span class="mono">${String(i + 1).padStart(2, '0')}</span>${esc(h)}</li>`).join('')}
      </ol>

      <ul class="panel__stack" aria-label="Technology">
        ${project.stack.map((s) => `<li class="mono" data-reveal>${esc(s)}</li>`).join('')}
      </ul>

      <a class="panel__cta" href="${esc(project.link)}" target="_blank" rel="noopener" data-reveal data-cursor="Visit">
        <span>Visit the project</span><span class="panel__arrow" aria-hidden="true">↗</span>
      </a>

      <span class="panel__rule" data-rule></span>

      <nav class="panel__pager mono" aria-label="Other projects" data-reveal>
        <button type="button" data-step="${prev}">← Previous world</button>
        <button type="button" data-step="${next}">Next world →</button>
      </nav>`
  }

  open(project, index, total, { reducedMotion }) {
    const swapping = this.isOpen && this.project !== project
    this.project = project
    this.isOpen = true
    this.timeline?.kill()

    const show = () => {
      this.render(project, index, total)
      this.root.hidden = false
      this.root.scrollTop = 0
      this.body.scrollTop = 0
      this.root.classList.add('is-open')
      this.lastFocus = document.activeElement
      requestAnimationFrame(() => this.root.querySelector('[data-close]')?.focus({ preventScroll: true }))

      if (reducedMotion) {
        gsap.set(this.root, { autoAlpha: 1 })
        return
      }
      const chars = this.body.querySelectorAll('.panel__char > span')
      const reveals = this.body.querySelectorAll('[data-reveal]')
      const rules = this.body.querySelectorAll('[data-rule]')
      this.timeline = gsap
        .timeline({ delay: swapping ? 0 : 0.75 })
        .fromTo(this.root, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, ease: 'power2.out' })
        .fromTo(this.root.querySelector('[data-close]'), { autoAlpha: 0, x: 12 }, { autoAlpha: 1, x: 0, duration: 0.8, ease: 'expo.out' }, 0.1)
        .fromTo(chars, { yPercent: 115, rotate: 6 }, { yPercent: 0, rotate: 0, duration: 1.3, stagger: 0.045, ease: 'expo.out' }, 0.1)
        .fromTo(rules, { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: 'expo.inOut', stagger: 0.25 }, 0.2)
        .fromTo(reveals, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 1, stagger: 0.035, ease: 'expo.out' }, 0.35)
    }

    if (swapping && !reducedMotion) {
      this.timeline = gsap.timeline().to(this.body, { autoAlpha: 0, y: -10, duration: 0.35, ease: 'power2.in' }).add(() => {
        gsap.set(this.body, { autoAlpha: 1, y: 0 })
        show()
      })
    } else {
      show()
    }
  }

  close({ reducedMotion }) {
    if (!this.isOpen) return
    this.isOpen = false
    this.timeline?.kill()
    const finish = () => {
      this.root.hidden = true
      this.root.classList.remove('is-open')
      this.body.innerHTML = ''
    }
    if (this.lastFocus?.isConnected) this.lastFocus.focus({ preventScroll: true })
    if (reducedMotion) return finish()
    this.timeline = gsap
      .timeline({ onComplete: finish })
      .to(this.body.querySelectorAll('[data-reveal], .panel__char > span'), { autoAlpha: 0, y: -8, duration: 0.35, stagger: 0.008, ease: 'power2.in' })
      .to(this.root, { autoAlpha: 0, duration: 0.45, ease: 'power2.in' }, 0.15)
  }

  dispose() {
    this.timeline?.kill()
    this.root.removeEventListener('click', this.onClick)
  }
}
