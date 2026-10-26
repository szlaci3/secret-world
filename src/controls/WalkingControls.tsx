import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useImperativeHandle, useRef } from 'react'
import type { Ref } from 'react'
import { PerspectiveCamera } from 'three'
import type { WorldDefinition } from '../world/schema'
import { WalkSession } from './WalkSession'
import type { WalkActions, WalkStatus } from './WalkSession'

export function WalkingControls({ world, ref, onStatus, onReady }: {
  world: WorldDefinition
  ref: Ref<WalkActions>
  onStatus: (status: WalkStatus) => void
  onReady: (ready: boolean) => void
}) {
  const { camera, gl, invalidate, size } = useThree()
  const session = useRef<WalkSession | null>(null)
  const initialWorld = useRef(world)
  useImperativeHandle(ref, () => ({
    enter: (next) => session.current?.enter(next),
    exit: () => session.current?.exit(),
    isMoving: () => session.current?.isMoving() ?? false,
  }), [])

  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return
    const current = new WalkSession(gl.domElement, camera, initialWorld.current, invalidate, onStatus)
    session.current = current
    onReady(true)
    return () => {
      current.dispose()
      session.current = null
      onReady(false)
    }
  }, [camera, gl, invalidate, onStatus, onReady])

  useEffect(() => {
    session.current?.replaceWorld(world)
    onReady(true)
  }, [world, onReady])

  useEffect(() => {
    session.current?.resizeOverview(size.width / size.height)
  }, [size.width, size.height])

  // Camera movement precedes distance-based scene detail selection this frame.
  useFrame((_, delta) => session.current?.update(delta), -1)
  return null
}
