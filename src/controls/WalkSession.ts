import { PerspectiveCamera } from 'three'
import type { WorldDefinition } from '../world/schema'
import { movementKeys, movementStep } from './movement'

export type WalkStatus = { phase: 'overview' | 'requesting' | 'walking'; error: string | null }
export type WalkActions = { enter: () => void; exit: () => void }

/** Owns browser input for exactly one mounted canvas; dispose removes everything. */
export class WalkSession implements WalkActions {
  private keys = new Set<string>()
  private active = false
  private pending = false
  private disposed = false
  private document: Document
  private window: Window

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: PerspectiveCamera,
    private world: WorldDefinition,
    private invalidate: () => void,
    private onStatus: (status: WalkStatus) => void,
  ) {
    this.document = canvas.ownerDocument
    this.window = this.document.defaultView!
    this.document.addEventListener('pointerlockchange', this.onLockChange)
    this.document.addEventListener('pointerlockerror', this.onLockError)
    this.document.addEventListener('keydown', this.onKeyDown)
    this.document.addEventListener('keyup', this.onKeyUp)
    this.document.addEventListener('mousemove', this.onMouseMove)
    this.document.addEventListener('visibilitychange', this.onVisibility)
    this.window.addEventListener('blur', this.onBlur)
    this.restoreOverview()
  }

  private restoreOverview() {
    this.camera.position.set(...this.world.camera.position)
    this.camera.lookAt(...this.world.camera.target)
    this.camera.fov = this.world.camera.fov
    this.camera.updateProjectionMatrix()
    this.invalidate()
  }

  enter = () => {
    if (this.disposed || this.active || this.pending || !this.world.walking) return
    if (!this.canvas.requestPointerLock) {
      this.onStatus({ phase: 'overview', error: 'Mouse capture is unavailable in this browser. The garden overview is still available.' })
      return
    }
    this.keys.clear()
    this.pending = true
    this.onStatus({ phase: 'requesting', error: null })
    try {
      // Request synchronously from the Enter button's user gesture.
      Promise.resolve(this.canvas.requestPointerLock()).catch(this.onLockError)
    } catch {
      this.onLockError()
    }
  }

  exit = () => {
    if (this.disposed) return
    const wasEngaged = this.active || this.pending
    this.active = false
    this.pending = false
    this.keys.clear()
    if (this.document.pointerLockElement === this.canvas) this.document.exitPointerLock()
    if (wasEngaged) {
      this.restoreOverview()
      this.onStatus({ phase: 'overview', error: null })
    }
  }

  private onLockChange = () => {
    if (this.document.pointerLockElement !== this.canvas) {
      this.exit()
      return
    }
    // A request may finish after a blur, cancellation, or visibility change.
    if (!this.pending || this.document.hidden || !this.document.hasFocus()) {
      this.exit()
      return
    }
    const walking = this.world.walking!
    this.pending = false
    this.active = true
    this.keys.clear()
    this.camera.position.set(...walking.spawn)
    this.camera.rotation.set(0, walking.yaw, 0, 'YXZ')
    this.camera.fov = walking.fov
    this.camera.updateProjectionMatrix()
    this.invalidate()
    this.onStatus({ phase: 'walking', error: null })
  }

  private onLockError = () => {
    if (this.disposed || !this.pending) return
    this.pending = false
    this.keys.clear()
    this.onStatus({ phase: 'overview', error: 'Mouse capture was declined. Select Enter garden to try again.' })
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (!this.active || event.isComposing) return
    if (event.code === 'Escape' || event.code === 'Tab') {
      event.preventDefault()
      this.exit()
    } else if (event.altKey || event.ctrlKey || event.metaKey) {
      this.exit()
    } else if (movementKeys.has(event.code)) {
      event.preventDefault()
      // Ignore repeats left over from a key held across focus loss/re-entry.
      if (!event.repeat) this.keys.add(event.code)
      this.invalidate()
    }
  }

  private onKeyUp = (event: KeyboardEvent) => { this.keys.delete(event.code) }

  private onMouseMove = (event: MouseEvent) => {
    if (!this.active || this.document.pointerLockElement !== this.canvas) return
    const sensitivity = this.world.walking!.lookSensitivity
    this.camera.rotation.y -= event.movementX * sensitivity
    this.camera.rotation.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05,
      this.camera.rotation.x - event.movementY * sensitivity))
    this.invalidate()
  }

  private onBlur = () => { this.exit() }
  private onVisibility = () => { if (this.document.hidden) this.exit() }

  update(delta: number) {
    if (!this.active || this.disposed) return
    const step = movementStep(this.keys, this.camera.rotation.y, this.world.walking!.speed, delta)
    if (step.x === 0 && step.z === 0) return
    this.camera.position.x += step.x
    this.camera.position.z += step.z
    this.invalidate()
  }

  dispose() {
    this.exit()
    this.disposed = true
    this.document.removeEventListener('pointerlockchange', this.onLockChange)
    this.document.removeEventListener('pointerlockerror', this.onLockError)
    this.document.removeEventListener('keydown', this.onKeyDown)
    this.document.removeEventListener('keyup', this.onKeyUp)
    this.document.removeEventListener('mousemove', this.onMouseMove)
    this.document.removeEventListener('visibilitychange', this.onVisibility)
    this.window.removeEventListener('blur', this.onBlur)
  }
}
