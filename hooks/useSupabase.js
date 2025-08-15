import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useSupabase() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Example function to test connection
  const testConnection = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Test connection by checking auth status
      const { data, error } = await supabase.auth.getSession()
      
      if (error) throw error
      
      console.log('Supabase connection successful!')
      return { success: true, message: 'Connection successful!' }
    } catch (err) {
      console.error('Supabase connection error:', err)
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Example function to insert data
  const insertData = async (tableName, data) => {
    try {
      setLoading(true)
      setError(null)
      
      const { data: result, error } = await supabase
        .from(tableName)
        .insert(data)
        .select()
      
      if (error) throw error
      
      return result
    } catch (err) {
      console.error('Insert error:', err)
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Example function to fetch data
  const fetchData = async (tableName, filters = {}) => {
    try {
      setLoading(true)
      setError(null)
      
      let query = supabase.from(tableName).select('*')
      
      // Apply filters if provided
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value)
      })
      
      const { data, error } = await query
      
      if (error) throw error
      
      return data
    } catch (err) {
      console.error('Fetch error:', err)
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    error,
    testConnection,
    insertData,
    fetchData,
    supabase
  }
}
