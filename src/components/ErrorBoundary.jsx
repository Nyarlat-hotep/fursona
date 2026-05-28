import { Component } from 'react'
import { clearDraft } from '../storage'
import './ErrorBoundary.css'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Last-ditch logging so the developer can see what blew up in console.
    console.error('Uncaught render error:', error, info)
  }

  handleReset = () => {
    clearDraft()
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="error-boundary">
        <div className="error-boundary-card">
          <h2>Something broke.</h2>
          <p>
            The app hit an unexpected error and can't continue. Starting over
            usually fixes it.
          </p>
          <details>
            <summary>Technical details</summary>
            <pre>{String(this.state.error?.message || this.state.error)}</pre>
          </details>
          <button type="button" className="error-boundary-btn" onClick={this.handleReset}>
            Start over
          </button>
        </div>
      </div>
    )
  }
}
