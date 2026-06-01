import React from 'react'
import { render } from '@testing-library/react'
import { Button } from '../button'
import { Badge } from '../badge'
import { StatCard } from '../../layout/StatCard'
import { Star } from 'lucide-react'

describe('Primitive UI Components', () => {
  it('renders Button correctly', () => {
    const { getByText, container } = render(<Button variant="destructive">Delete</Button>)
    expect(getByText('Delete')).toBeInTheDocument()
    // Should have destructive classes from tailwind variant
    expect(container.firstChild).toHaveClass('bg-destructive')
  })

  it('renders Badge correctly', () => {
    const { getByText, container } = render(<Badge variant="success">Active</Badge>)
    expect(getByText('Active')).toBeInTheDocument()
    expect(container.firstChild).toHaveClass('bg-green-100')
  })

  it('renders StatCard correctly', () => {
    const { getByText } = render(
      <StatCard
        title="Total Resumes"
        value={42}
        icon={Star}
        colorClass="bg-blue-100"
        iconColor="text-blue-500"
      />
    )
    expect(getByText('Total Resumes')).toBeInTheDocument()
    expect(getByText('42')).toBeInTheDocument()
  })
})
