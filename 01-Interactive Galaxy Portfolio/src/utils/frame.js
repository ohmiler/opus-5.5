/**
 * Resolves on the next animation frame, or after a short timeout when the tab
 * is hidden (rAF is paused there) — so loading still completes in a
 * background tab.
 */
export const nextFrame = () =>
  new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      resolve()
    }
    requestAnimationFrame(finish)
    setTimeout(finish, 60)
  })
