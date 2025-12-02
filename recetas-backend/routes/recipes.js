const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// Obtener todas las recetas (público)
router.get('/', async (req, res) => {
  try {
    const [recipes] = await db.query('SELECT * FROM recipes ORDER BY created_at DESC');
    
    // Obtener ingredientes y pasos para cada receta
    for (let recipe of recipes) {
      const [ingredients] = await db.query(
        'SELECT ingredient FROM ingredients WHERE recipe_id = ?',
        [recipe.id]
      );
      const [steps] = await db.query(
        'SELECT description FROM steps WHERE recipe_id = ? ORDER BY step_number',
        [recipe.id]
      );
      
      recipe.ingredients = ingredients.map(i => i.ingredient);
      recipe.steps = steps.map(s => s.description);
    }
    
    res.json(recipes);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener recetas' });
  }
});

// Crear receta (requiere autenticación)
router.post('/', authenticateToken, async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { title, category, time, difficulty, servings, image, ingredients, steps } = req.body;
    
    // Insertar receta
    const [result] = await connection.query(
        'INSERT INTO recipes (title, category, time, difficulty, servings, image, author, user_id, curiosities) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [title, category, time, difficulty, servings, image, req.user.name, req.user.id, curiosities]
    );
    
    const recipeId = result.insertId;
    
    // Insertar ingredientes
    for (let ingredient of ingredients) {
      await connection.query(
        'INSERT INTO ingredients (recipe_id, ingredient) VALUES (?, ?)',
        [recipeId, ingredient]
      );
    }
    
    // Insertar pasos
    for (let i = 0; i < steps.length; i++) {
      await connection.query(
        'INSERT INTO steps (recipe_id, step_number, description) VALUES (?, ?, ?)',
        [recipeId, i + 1, steps[i]]
      );
    }
    
    await connection.commit();
    res.status(201).json({ message: 'Receta creada exitosamente', id: recipeId });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: 'Error al crear receta' });
  } finally {
    connection.release();
  }
});

module.exports = router;