import gsap from 'gsap'

/**
 * Editorial copy for the two non-planet sections: the opening (Origin) and
 * the closing contact (Signal). Lines rise out of masks as the camera
 * arrives and sink away when it leaves.
 */
export class SectionCopy {
  constructor({ intro, outro, owner, lastIndex }) {
    this.panels = { 0: intro, [lastIndex]: outro }
    this.visible = null

    intro.querySelector('[data-owner-name]').textContent = owner.name
    const mail = outro.querySelector('[data-mail]')
    mail.href = `mailto:${owner.email}`
    mail.textContent = owner.email
    outro.querySelector('[data-links]').innerHTML = owner.links
      .map((l) => `<li><a href="${l.href}" target="_blank" rel="noopener">${l.label}<span aria-hidden="true">↗</span></a></li>`)
      .join('')
    outro.querySelector('[data-location]').textContent = owner.location

    for (const el of Object.values(this.panels)) gsap.set(el, { autoAlpha: 0 })
  }

  items(el) {
    return el.querySelectorAll('[data-line] > span, [data-fade]')
  }

  show(index, { reducedMotion, delay = 0 }) {
    const el = this.panels[index] ?? null
    if (el === this.visible) return
    if (this.visible) this.hide(this.visible, reducedMotion)
    this.visible = el
    if (!el) return

    gsap.killTweensOf([el, ...this.items(el)])
    el.inert = false
    if (reducedMotion) {
      gsap.set(el, { autoAlpha: 1 })
      gsap.set(this.items(el), { autoAlpha: 1, yPercent: 0, y: 0 })
      return
    }
    gsap.set(el, { autoAlpha: 1 })
    gsap.fromTo(
      el.querySelectorAll('[data-line] > span'),
      { yPercent: 110 },
      { yPercent: 0, duration: 1.5, stagger: 0.09, ease: 'expo.out', delay },
    )
    gsap.fromTo(
      el.querySelectorAll('[data-fade]'),
      { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: 1.2, stagger: 0.07, ease: 'expo.out', delay: delay + 0.35 },
    )
  }

  hide(el, reducedMotion) {
    el.inert = true
    gsap.killTweensOf([el, ...this.items(el)])
    if (reducedMotion) {
      gsap.set(el, { autoAlpha: 0 })
      return
    }
    gsap.to(el.querySelectorAll('[data-line] > span'), { yPercent: -110, duration: 0.6, stagger: 0.04, ease: 'power3.in' })
    gsap.to(el.querySelectorAll('[data-fade]'), { autoAlpha: 0, y: -10, duration: 0.4, ease: 'power2.in' })
    gsap.to(el, { autoAlpha: 0, duration: 0.3, delay: 0.55 })
  }
}
