// @ts-nocheck - Deno runtime types not available in local VS Code
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Edamam API configuration
const EDAMAM_APP_ID = Deno.env.get('EDAMAM_APP_ID') ?? ''
const EDAMAM_APP_KEY = Deno.env.get('EDAMAM_APP_KEY') ?? ''
const EDAMAM_BASE_URL = 'https://api.edamam.com/api/recipes/v2'

// Rate limit: 10 recipes per minute
const RECIPES_PER_BATCH = 10
const BATCH_DELAY_MS = 60 * 1000 // 1 minute between batches

serve(async (req) => {
  const startTime = Date.now()
  
  try {
    console.log('🔄 Starting automatic popular recipes refresh...')

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('PROJECT_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    )

    // Define diverse search queries
    const searchQueries = [
      { query: 'chicken', mealType: 'Dinner', label: 'Chicken Dinners' },
      { query: 'pasta', cuisineType: 'Italian', label: 'Italian Pasta' },
      { query: 'salad', dishType: 'Salad', label: 'Fresh Salads' },
      { query: 'soup', mealType: 'Lunch', label: 'Comfort Soups' },
      { query: 'vegetarian', health: 'vegetarian', label: 'Vegetarian' },
      { query: 'beef', mealType: 'Dinner', label: 'Beef Dishes' },
      { query: 'fish', dishType: 'Main course', label: 'Seafood' },
      { query: 'dessert', dishType: 'Desserts', label: 'Desserts' }
    ]

    const allRecipes = []
    let batchNumber = 0
    const maxBatches = 6 // 6 batches = 60 recipes (respects rate limit)

    // Fetch recipes in batches (10 per minute)
    for (const search of searchQueries.slice(0, maxBatches)) {
      batchNumber++
      console.log(`📦 Batch ${batchNumber}/${maxBatches}: Fetching ${search.label}...`)

      try {
        // Fetch 10 recipes per batch
        const recipes = await fetchEdamamRecipes(search.query, {
          to: 10,
          type: 'public',
          ...(search.mealType && { mealType: search.mealType }),
          ...(search.cuisineType && { cuisineType: search.cuisineType }),
          ...(search.dishType && { dishType: search.dishType }),
          ...(search.health && { health: search.health })
        })

        if (recipes.length > 0) {
          allRecipes.push(...recipes)
          console.log(`✅ Batch ${batchNumber}: Fetched ${recipes.length} ${search.label}`)
        } else {
          console.warn(`⚠️ Batch ${batchNumber}: No recipes found for ${search.label}`)
        }

      } catch (error) {
        console.error(`❌ Batch ${batchNumber} failed:`, error.message)
      }

      // Wait 1 minute before next batch (except for last batch)
      if (batchNumber < maxBatches) {
        console.log(`⏱️ Waiting 60 seconds before next batch (rate limit: 10/min)...`)
        await delay(BATCH_DELAY_MS)
      }
    }

    // Remove duplicates by URI
    const uniqueRecipes = Array.from(
      new Map(allRecipes.map(recipe => [recipe.uri, recipe])).values()
    )

    // Shuffle for variety
    const shuffled = uniqueRecipes.sort(() => Math.random() - 0.5)

    console.log(`✅ Total recipes fetched: ${allRecipes.length}`)
    console.log(`✅ Unique recipes: ${shuffled.length}`)

    if (shuffled.length === 0) {
      throw new Error('No recipes fetched from any batch')
    }

    // Delete old cache entries
    await supabase
      .from('cache_popular_recipes')
      .delete()
      .neq('id', 0)

    // Save new cache with 6-hour expiration
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000)
    const { error: insertError } = await supabase
      .from('cache_popular_recipes')
      .insert({
        recipes: shuffled,
        expires_at: expiresAt.toISOString()
      })

    if (insertError) {
      throw insertError
    }

    const executionTime = Date.now() - startTime
    const executionMinutes = Math.round(executionTime / 60000)

    console.log(`✅ Popular recipes cache refreshed successfully`)
    console.log(`📊 Stats: ${shuffled.length} recipes, ${batchNumber} batches, ${executionMinutes} minutes`)

    return new Response(
      JSON.stringify({
        success: true,
        recipesCount: shuffled.length,
        batchesProcessed: batchNumber,
        executionTime: `${executionMinutes} minutes`,
        expiresAt: expiresAt.toISOString(),
        message: 'Popular recipes cache refreshed successfully'
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('❌ Error refreshing popular recipes:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

/**
 * Fetch recipes from Edamam API
 */
async function fetchEdamamRecipes(query: string, params: any = {}) {
  const url = new URL(EDAMAM_BASE_URL)
  url.searchParams.append('q', query)
  url.searchParams.append('app_id', EDAMAM_APP_ID)
  url.searchParams.append('app_key', EDAMAM_APP_KEY)
  url.searchParams.append('type', params.type || 'public')
  url.searchParams.append('from', '0')
  url.searchParams.append('to', params.to?.toString() || '10')

  // Add optional filters
  if (params.mealType) url.searchParams.append('mealType', params.mealType)
  if (params.cuisineType) url.searchParams.append('cuisineType', params.cuisineType)
  if (params.dishType) url.searchParams.append('dishType', params.dishType)
  if (params.health) url.searchParams.append('health', params.health)

  const response = await fetch(url.toString())

  if (!response.ok) {
    throw new Error(`Edamam API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  
  // Extract recipe data
  return (data.hits || []).map((hit: any) => hit.recipe)
}

/**
 * Delay execution for specified milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
