import { FiCheck, FiDroplet } from 'react-icons/fi';
import { THEMES, useTheme } from '../../hooks/useTheme';

export default function Settings() {
  const { themeId, changeTheme } = useTheme();
  const active = THEMES.find(t => t.id === themeId);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-[#f3f4f6]">Settings</h2>
        <p className="text-sm text-[#6b7280] mt-0.5">Manage your portal preferences</p>
      </div>

      <div className="hud-card hud-card-accent overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)' }}>
              <FiDroplet size={18} style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <p className="font-bold text-[#f3f4f6]">Accent Color</p>
              <p className="text-xs text-[#6b7280] mt-0.5">Choose primary color for the interface</p>
            </div>
            <span className="ml-auto text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: 'rgba(6,182,212,0.1)', color: 'var(--color-primary)', border: '1px solid rgba(6,182,212,0.2)' }}>
              {active?.name} Active
            </span>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <p className="hud-section-label">Select Theme</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {THEMES.map(theme => {
              const isActive = themeId === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => changeTheme(theme.id)}
                  className="relative rounded-xl p-4 text-left transition-all duration-200"
                  style={{
                    background: isActive ? `${theme.primary}14` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isActive ? theme.primary + '60' : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: isActive ? `0 0 16px ${theme.primary}25` : 'none',
                  }}
                >
                  {isActive && (
                    <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: theme.primary }}>
                      <FiCheck size={10} className="text-white" strokeWidth={3.5} />
                    </span>
                  )}
                  <div className="flex gap-1.5 mb-3">
                    <span className="w-7 h-7 rounded-full" style={{ background: theme.primary, boxShadow: `0 0 8px ${theme.primary}50` }} />
                    <span className="w-7 h-7 rounded-full opacity-60" style={{ background: theme.light }} />
                  </div>
                  <p className="text-sm font-semibold text-[#f3f4f6]">{theme.name}</p>
                  <p className="text-[11px] text-[#6b7280] mt-0.5 leading-tight">{theme.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Live Preview */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="px-4 py-2.5" style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="hud-section-label">Live Preview</span>
            </div>
            <div className="px-4 py-4 flex items-center gap-3 flex-wrap">
              <button className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: `linear-gradient(135deg, ${active?.primary}, ${active?.dark})`, boxShadow: `0 0 16px ${active?.primary}40` }}>
                Primary Button
              </button>
              <span className="px-3 py-1.5 rounded-full text-xs font-bold text-white"
                style={{ background: active?.primary }}>
                Badge
              </span>
              <span className="px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ background: `${active?.primary}18`, color: active?.primary, border: `1px solid ${active?.primary}35` }}>
                Light Badge
              </span>
              <span className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: `${active?.primary}18`, border: `1px solid ${active?.primary}30` }}>
                <FiDroplet size={14} style={{ color: active?.primary }} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
