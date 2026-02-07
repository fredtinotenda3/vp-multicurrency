export default function QuickNavigation() {
  const quickActions = [
    { 
      icon: '💰', 
      title: 'New Invoice', 
      description: 'Create multi-currency invoice',
      color: 'bg-currency-usd/10',
      borderColor: 'border-currency-usd'
    },
    { 
      icon: '🏥', 
      title: 'Medical Aid', 
      description: 'Process medical aid claims',
      color: 'bg-vp-secondary/10',
      borderColor: 'border-vp-secondary'
    },
    { 
      icon: '📊', 
      title: 'Daily Report', 
      description: 'View currency reports',
      color: 'bg-vp-primary/10',
      borderColor: 'border-vp-primary'
    },
    { 
      icon: '⚙️', 
      title: 'Rates', 
      description: 'Update exchange rates',
      color: 'bg-currency-locked/10',
      borderColor: 'border-currency-locked'
    },
  ]

  return (
    <div className="vp-card mb-6">
      <div className="vp-card-header">
        Quick Actions
      </div>
      <div className="vp-card-body">
        <div className="vp-grid vp-grid-4 gap-4">
          {quickActions.map((action, index) => (
            <button
              key={index}
              className={`p-4 rounded-lg border-2 ${action.borderColor} ${action.color} hover:shadow-lg transition-shadow text-left`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{action.icon}</span>
                <span className="font-bold text-vp-primary">{action.title}</span>
              </div>
              <div className="text-sm text-gray-600">{action.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}