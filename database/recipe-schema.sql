-- Recipe-related tables for REcipe app

-- Table for storing user's favorite recipes from Edamam API
CREATE TABLE IF NOT EXISTS tbl_favorites (
    favoriteID SERIAL PRIMARY KEY,
    userID INTEGER NOT NULL,
    recipeURI TEXT NOT NULL, -- Edamam recipe URI
    recipeTitle TEXT NOT NULL,
    recipeImage TEXT,
    recipeSource TEXT,
    recipeCalories INTEGER,
    recipeCookingTime INTEGER, -- in minutes
    recipeServings INTEGER,
    recipeData JSONB, -- Store full recipe data from Edamam
    dateAdded TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(userID, recipeURI) -- Prevent duplicate favorites
);

-- Table for storing user's custom recipes
CREATE TABLE IF NOT EXISTS tbl_custom_recipes (
    recipeID SERIAL PRIMARY KEY,
    userID INTEGER NOT NULL,
    recipeTitle TEXT NOT NULL,
    recipeDescription TEXT,
    recipeIngredients JSONB NOT NULL, -- Array of ingredients
    recipeInstructions JSONB NOT NULL, -- Array of instructions
    recipeCookingTime INTEGER, -- in minutes
    recipeServings INTEGER,
    recipeImage TEXT, -- URL to image
    recipeCategory TEXT, -- breakfast, lunch, dinner, dessert, etc.
    dateCreated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    dateModified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    isPublic BOOLEAN DEFAULT false -- Whether recipe can be shared with other users
);

-- Table for recipe collections/meal plans
CREATE TABLE IF NOT EXISTS tbl_collections (
    collectionID SERIAL PRIMARY KEY,
    userID INTEGER NOT NULL,
    collectionName TEXT NOT NULL,
    collectionDescription TEXT,
    collectionImage TEXT,
    dateCreated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    isPublic BOOLEAN DEFAULT false
);

-- Junction table for recipes in collections
CREATE TABLE IF NOT EXISTS tbl_collection_recipes (
    collectionRecipeID SERIAL PRIMARY KEY,
    collectionID INTEGER NOT NULL REFERENCES tbl_collections(collectionID) ON DELETE CASCADE,
    recipeURI TEXT, -- For Edamam recipes
    customRecipeID INTEGER, -- For custom recipes, references tbl_custom_recipes(recipeID)
    dateAdded TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT -- User notes for this recipe in this collection
);

-- Table for recipe ratings and reviews
CREATE TABLE IF NOT EXISTS tbl_recipe_reviews (
    reviewID SERIAL PRIMARY KEY,
    userID INTEGER NOT NULL,
    recipeURI TEXT, -- For Edamam recipes
    customRecipeID INTEGER, -- For custom recipes
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    dateReviewed TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for shopping lists
CREATE TABLE IF NOT EXISTS tbl_shopping_lists (
    listID SERIAL PRIMARY KEY,
    userID INTEGER NOT NULL,
    listName TEXT NOT NULL DEFAULT 'My Shopping List',
    dateCreated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    dateModified TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for shopping list items
CREATE TABLE IF NOT EXISTS tbl_shopping_items (
    itemID SERIAL PRIMARY KEY,
    listID INTEGER NOT NULL REFERENCES tbl_shopping_lists(listID) ON DELETE CASCADE,
    itemName TEXT NOT NULL,
    quantity TEXT,
    unit TEXT,
    category TEXT, -- produce, dairy, meat, etc.
    isCompleted BOOLEAN DEFAULT false,
    dateAdded TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    recipeURI TEXT, -- If item comes from a specific recipe
    customRecipeID INTEGER -- If item comes from a custom recipe
);

-- Table for meal planning
CREATE TABLE IF NOT EXISTS tbl_meal_plans (
    mealPlanID SERIAL PRIMARY KEY,
    userID INTEGER NOT NULL,
    planDate DATE NOT NULL,
    mealType TEXT NOT NULL, -- breakfast, lunch, dinner, snack
    recipeURI TEXT, -- For Edamam recipes
    customRecipeID INTEGER, -- For custom recipes
    servings INTEGER DEFAULT 1,
    notes TEXT,
    dateCreated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_favorites_user ON tbl_favorites(userID);
CREATE INDEX IF NOT EXISTS idx_favorites_recipe ON tbl_favorites(recipeURI);
CREATE INDEX IF NOT EXISTS idx_custom_recipes_user ON tbl_custom_recipes(userID);
CREATE INDEX IF NOT EXISTS idx_collections_user ON tbl_collections(userID);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_user ON tbl_shopping_lists(userID);
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_date ON tbl_meal_plans(userID, planDate);

-- Add some sample data for testing (optional)
-- INSERT INTO tbl_collections (userID, collectionName, collectionDescription) 
-- VALUES (1, 'Quick Weeknight Dinners', 'Fast and easy dinner recipes for busy weeknights');

COMMENT ON TABLE tbl_favorites IS 'Stores user favorite recipes from Edamam API';
COMMENT ON TABLE tbl_custom_recipes IS 'User-created custom recipes';
COMMENT ON TABLE tbl_collections IS 'Recipe collections and meal plans';
COMMENT ON TABLE tbl_collection_recipes IS 'Recipes within collections';
COMMENT ON TABLE tbl_recipe_reviews IS 'User ratings and reviews for recipes';
COMMENT ON TABLE tbl_shopping_lists IS 'User shopping lists';
COMMENT ON TABLE tbl_shopping_items IS 'Items in shopping lists';
COMMENT ON TABLE tbl_meal_plans IS 'Meal planning calendar';
