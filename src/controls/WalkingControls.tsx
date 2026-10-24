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
  useImperativeHandle(ref, () => ({
    enter: () => session.current?.enter(),
    exit: () => session.current?.exit(),
    isMoving: () => session.current?.isMoving() ?? false,
  }), [])

  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return
    const current = new WalkSession(gl.domElement, camera, world, invalidate, onStatus)
    session.current = current
    onReady(true)
    return () => {
      current.dispose()
      session.current = null
      onReady(false)
    }
  }, [camera, gl, world, invalidate, onStatus, onReady])

  useEffect(() => {
    session.current?.resizeOverview(size.width / size.height)
  }, [size.width, size.height])

  useFrame((_, delta) => session.current?.update(delta))
  return null
}
