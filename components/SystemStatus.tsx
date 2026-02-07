export default function SystemStatus() {
  const statusItems = [
    { label: 'System Status', value: 'Operational', status: 'good' },
    { label: 'Exchange Rate API', value: 'Connected', status: 'good' },
    { label: 'Today\'s Rate', value: '1 USD = 1,250 ZWL', status: 'info' },
    { label: 'Last Backup', value: 'Today 02:00 AM', status: 'good' },
    { label: 'Pending Transactions', value: '3', status: 'warning' },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-status-cleared';
      case 'warning': return 'text-status-pending';
      case 'error': return 'text-status-error';
      default: return 'text-vp-secondary';
    }
  }

  return (
    <div className="vp-card mb-6">
      <div className="vp-card-header">
        System Status
      </div>
      <div className="vp-card-body">
        <div className="vp-grid vp-grid-5 gap-4">
          {statusItems.map((item, index) => (
            <div key={index} className="text-center">
              <div className="text-sm text-gray-600 mb-1">{item.label}</div>
              <div className={`font-bold ${getStatusColor(item.status)}`}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-status-cleared"></div>
            <span className="text-sm">Operational</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-status-pending"></div>
            <span className="text-sm">Warning</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-status-error"></div>
            <span className="text-sm">Error</span>
          </div>
        </div>
      </div>
    </div>
  )
}