import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import RecipeSearch from '../../../app/(tabs)/recipe-search';
import EdamamService from '../../../services/edamam-service';

jest.mock('../../../services/edamam-service');
jest.mock('../../../hooks/use-custom-auth', () => ({
  useCustomAuth: jest.fn(() => ({
    user: { id: '123' },
    customUserData: { userID: 123, userName: 'Test User' },
  })),
}));

describe('RecipeSearch Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render search input', () => {
    const { getByPlaceholderText } = render(<RecipeSearch />);
    expect(getByPlaceholderText(/search/i)).toBeTruthy();
  });

  it('should search recipes when button pressed', async () => {
    const mockRecipes = [
      {
        uri: 'recipe_1',
        label: 'Chicken Curry',
        image: 'https://example.com/image.jpg',
        totalTime: 30,
      },
    ];

    EdamamService.searchRecipes.mockResolvedValue({
      success: true,
      data: { recipes: mockRecipes },
    });

    const { getByPlaceholderText, getByText } = render(<RecipeSearch />);

    const searchInput = getByPlaceholderText(/search/i);
    const searchButton = getByText(/search/i);

    fireEvent.changeText(searchInput, 'chicken');
    fireEvent.press(searchButton);

    await waitFor(() => {
      expect(EdamamService.searchRecipes).toHaveBeenCalledWith(
        'chicken',
        expect.any(Object)
      );
    });
  });

  it('should display loading indicator during search', async () => {
    EdamamService.searchRecipes.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );

    const { getByPlaceholderText, getByText, queryByText } = render(
      <RecipeSearch />
    );

    fireEvent.changeText(getByPlaceholderText(/search/i), 'chicken');
    fireEvent.press(getByText(/search/i));

    expect(queryByText(/searching/i)).toBeTruthy();
  });

  it('should handle search errors gracefully', async () => {
    EdamamService.searchRecipes.mockRejectedValue(
      new Error('Network error')
    );

    const { getByPlaceholderText, getByText } = render(<RecipeSearch />);

    fireEvent.changeText(getByPlaceholderText(/search/i), 'chicken');
    fireEvent.press(getByText(/search/i));

    await waitFor(() => {
      expect(EdamamService.searchRecipes).toHaveBeenCalled();
    });
  });
});
