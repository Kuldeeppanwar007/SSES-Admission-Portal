import { FiCheck, FiDroplet } from 'react-icons/fi';
import { THEMES, useTheme } from '../../hooks/useTheme';

export default function Settings() {
  const { themeId, changeTheme } = useTheme();
  const active = THEMES.find(t => t.id === themeId);

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage your portal preferences</p>
        </div>
      </div>

      {/* Color Theme Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Card Header — same as Dashboard cards */}
        <div className="px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
              <FiDroplet size={18} className="text-primary" />
            </div>
            <div>
              <p className="font-bold text-gray-800">Color Theme</p>
              <p className="text-xs text-gray-400 mt-0.5">Choose a primary color for the interface</p>
            </div>
            <span className="ml-auto text-xs font-bold px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
              {active?.name} Active
            </span>
          </div>
        </div>

        <div className="p-5 space-y-5">

          {/* Section label */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select Theme</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Theme Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {THEMES.map(theme => {
              const isActive = themeId === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => changeTheme(theme.id)}
                  className={`relative rounded-xl border-2 p-4 text-left transition-all duration-200 group ${
                    isActive
                      ? 'shadow-md'
                      : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'
                  }`}
                  style={isActive
                    ? { borderColor: theme.primary, background: `${theme.primary}0d` }
                    : {}
                  }
                >
                  {isActive && (
                    <span
                      className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center shadow-sm"
                      style={{ background: theme.primary }}
                    >
                      <FiCheck size={10} className="text-white" strokeWidth={3.5} />
                    </span>
                  )}

                  <div className="flex gap-1.5 mb-3">
                    <span className="w-8 h-8 rounded-full shadow-sm border border-white/50"
                      style={{ background: theme.primary }} />
                    <span className="w-8 h-8 rounded-full shadow-sm border border-white/50"
                      style={{ background: theme.light }} />
                  </div>

                  <p className="text-sm font-semibold text-gray-800">{theme.name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">{theme.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Preview Section — same style as stat cards */}
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-2.5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Live Preview</span>
            </div>
            <div className="px-4 py-4 flex items-center gap-3 flex-wrap">
              <button
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm"
                style={{ background: active?.primary, boxShadow: `0 4px 12px ${active?.primary}50` }}
              >
                Primary Button
              </button>
              <span
                className="px-3 py-1.5 rounded-full text-xs font-bold text-white"
                style={{ background: active?.primary }}
              >
                Badge
              </span>
              <span
                className="px-3 py-1.5 rounded-full text-xs font-bold border"
                style={{
                  background: `${active?.primary}18`,
                  color: active?.primary,
                  borderColor: `${active?.primary}35`
                }}
              >
                Light Badge
              </span>
              <span
                className="w-9 h-9 rounded-xl shadow-sm flex items-center justify-center"
                style={{ background: active?.primary }}
              >
                <FiDroplet size={14} className="text-white" />
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
