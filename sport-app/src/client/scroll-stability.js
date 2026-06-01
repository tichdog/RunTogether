export function setIfChanged(setter, nextValue) {
  setter((previousValue) => (isSameData(previousValue, nextValue) ? previousValue : nextValue))
}

export async function preservingScroll(task) {
  const snapshot = captureScrollSnapshot()

  try {
    return await task()
  } finally {
    restoreScrollSnapshot(snapshot)
  }
}

function isSameData(left, right) {
  if (left === right) return true

  try {
    return JSON.stringify(left) === JSON.stringify(right)
  } catch {
    return false
  }
}

function captureScrollSnapshot() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null

  const elements = new Set()
  const scrollingElement = document.scrollingElement || document.documentElement
  if (scrollingElement) elements.add(scrollingElement)

  document.querySelectorAll('.rt-main, .app-main, [data-preserve-scroll]').forEach((element) => {
    elements.add(element)
  })

  let current = document.activeElement
  while (current && current !== document.body) {
    if (current.scrollHeight > current.clientHeight || current.scrollWidth > current.clientWidth) {
      elements.add(current)
    }
    current = current.parentElement
  }

  return {
    windowX: window.scrollX,
    windowY: window.scrollY,
    elements: [...elements].map((element) => ({
      element,
      left: element.scrollLeft,
      top: element.scrollTop,
    })),
  }
}

function restoreScrollSnapshot(snapshot) {
  if (!snapshot || typeof window === 'undefined') return

  const restore = () => {
    snapshot.elements.forEach(({ element, left, top }) => {
      if (!element.isConnected) return
      element.scrollLeft = left
      element.scrollTop = top
    })
    window.scrollTo(snapshot.windowX, snapshot.windowY)
  }

  restore()
  window.requestAnimationFrame(() => {
    restore()
    window.requestAnimationFrame(restore)
  })
}
