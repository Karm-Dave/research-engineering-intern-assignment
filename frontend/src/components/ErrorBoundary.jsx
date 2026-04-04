import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('UI error', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-card rounded-lg p-6 text-slate-200">
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="text-sm text-slate-400">Refresh the page or check the console for details.</p>
        </div>
      )
    }
    return this.props.children
  }
}
