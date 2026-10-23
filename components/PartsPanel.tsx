'use client'
import { useEffect } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { message, Popover } from 'antd'
import type { Preset } from '@/types/manifest'
import {
  selectBase, selectCurrentPreset, selectEquippedCount, selectEquippedIds, selectPartsInActiveSlot, selectVisibleSlots,
} from '@/state/avatarStore'
import { basesFitByPreset, presetFitsBase } from '@/avatar/slotRules'
import { useDressUp } from './DressUpContext'
import PartCard from './PartCard'
import SlotIcon from './SlotIcon'
import styles from './dressup.module.css'

/** 套装卡上的色块：按套装名取色，没列的用默认 */
const PRESET_SWATCH: Record<string, string> = {
  ranger: 'linear-gradient(135deg, #5A6A42, #2B3322)',
  peasant: 'linear-gradient(135deg, #8A6B4A, #4A3826)',
  light: 'linear-gradient(135deg, #6E7B8C, #333B47)',
  heavy: 'linear-gradient(135deg, #7A6A55, #3A322A)',
  wizard: 'linear-gradient(135deg, #5C4A7A, #2C2340)',
}

export default function PartsPanel() {
  const { manifest, store, loadingIds, errors } = useDressUp()
  const activeSlot = useStore(store, (s) => s.activeSlot)
  const base = useStore(store, (s) => selectBase(manifest, s))
  const visibleSlots = useStore(store, useShallow((s) => selectVisibleSlots(manifest, s)))
  const parts = useStore(store, useShallow((s) => selectPartsInActiveSlot(manifest, s)))
  const equippedIds = useStore(store, useShallow((s) => selectEquippedIds(s)))
  const count = useStore(store, selectEquippedCount)
  const currentPreset = useStore(store, (s) => selectCurrentPreset(manifest, s))

  // 当前底模下激活的槽位没有部件时，跳到第一个有部件的槽位
  useEffect(() => {
    if (visibleSlots.length && !visibleSlots.some((s) => s.id === activeSlot)) {
      store.getState().setActiveSlot(visibleSlots[0].id)
    }
  }, [visibleSlots, activeSlot, store])

  const slot = manifest.slots.find((s) => s.id === activeSlot)
  // 从已订阅的派生值推出来，不在渲染期读 getState
  const slotEmpty = !parts.some((p) => equippedIds.includes(p.id))
  const hint = slot ? (slot.multiple ? '可多选' : '单选') : ''

  function presetMeta(p: Preset): string {
    const n = Object.keys(p.parts).length
    return currentPreset?.id === p.id ? `${n} 件 · 已装` : `${n} 件`
  }

  /** 置灰套装的提示：两行结构——结论行（谁能穿）+ 行动行（怎么办） */
  function presetTip(p: Preset): string | undefined {
    if (presetFitsBase(manifest, p, base)) return undefined
    const fitting = basesFitByPreset(manifest, p)
    if (!fitting.length) return '当前没有任何底模能穿这套服装'
    return `该套装仅「${fitting.map((b) => b.label).join('、')}」底模可穿\n请先切换底模，再回来装备`
  }

  function onPresetClick(p: Preset): void {
    const tip = presetTip(p)
    if (tip) {
      // 置灰也能点：明确告知原因与出路，比静默无效更友好
      void message.info(tip)
      return
    }
    store.getState().applyPreset(p)
  }

  return (
    <aside className={styles.panel} aria-label="部件面板">
      {/* 三个模块各自独立滚动：套装区（标题固定、卡片列表滚）、槽位 tabs（横向滚）、部件网格（标题固定、网格滚）；footer 固定 */}
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={`font-display ${styles.sectionTitle}`}>一键套装</h2>
          <span className={styles.sectionHint}>装上一件会自动补齐整套</span>
        </div>
        <div className={styles.presetGrid}>
          {manifest.presets.map((p) => {
            const tip = presetTip(p)
            const disabled = !!tip
            const card = (
              <button
                key={p.id}
                type="button"
                className={`${styles.presetCard} ${currentPreset?.id === p.id ? styles.presetCardActive : ''} ${disabled ? styles.presetCardDisabled : ''}`}
                aria-disabled={disabled}
                onClick={() => onPresetClick(p)}
              >
                <span aria-hidden="true" className={styles.presetSwatch} style={{ background: PRESET_SWATCH[p.id] ?? 'linear-gradient(135deg, #4A4458, #2A2634)' }} />
                <span>
                  <span className={styles.presetName}>{p.label}</span>
                  <br />
                  <span className={styles.presetMeta}>{presetMeta(p)}</span>
                </span>
              </button>
            )
            // 置灰套装：antd Popover 悬停提示（portal 渲染，不受滚动容器裁剪）
            if (!disabled) return card
            return (
              <Popover
                key={p.id}
                content={
                  <div className={styles.presetTip}>
                    <div className={styles.presetTipTitle}>ⓘ {tip?.split('\n')[0]}</div>
                    {tip?.includes('\n') && <div className={styles.presetTipAction}>{tip.split('\n')[1]}</div>}
                  </div>
                }
                placement="top"
                trigger="hover"
                styles={{ body: { padding: '10px 14px' } }}
              >
                {card}
              </Popover>
            )
          })}
        </div>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="部位">
        {visibleSlots.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === activeSlot}
            className={`${styles.tab} ${s.id === activeSlot ? styles.tabActive : ''}`}
            onClick={() => store.getState().setActiveSlot(s.id)}
          >
            <SlotIcon slotId={s.id} />
            {s.label}
          </button>
        ))}
      </div>

      <div className={styles.gridScroll}>
        <div className={styles.gridHead}>
          <span className={styles.gridTitle}>{slot?.label ?? ''}</span>
          <span className={styles.sectionHint}>{hint}</span>
        </div>
        <div className={styles.grid}>
          {slot && !slot.multiple && !base.initialParts?.[slot.id] && (
            <button
              type="button"
              className={`${styles.part} ${slotEmpty ? styles.partSelected : ''}`}
              onClick={() => store.getState().unequip(slot.id)}
              aria-pressed={slotEmpty}
            >
              <span className={`${styles.thumb} ${styles.thumbNone}`} />
              <span className={`${styles.partLabel} ${slotEmpty ? styles.partLabelSelected : ''}`}>无</span>
            </button>
          )}
          {parts.map((p) => (
            <PartCard
              key={p.id}
              part={p}
              selected={equippedIds.includes(p.id)}
              loading={loadingIds.has(p.id)}
              error={errors.get(p.id)}
              onClick={() => store.getState().toggle(p)}
            />
          ))}
        </div>
      </div>

      <div className={styles.footer}>
        <span>已装 {count} 件 · {currentPreset?.label ?? '混搭'} · {base.label}</span>
        <button type="button" className={`btn-ghost ${styles.footerBtn}`} onClick={() => store.getState().reset()}>重置</button>
      </div>
    </aside>
  )
}
